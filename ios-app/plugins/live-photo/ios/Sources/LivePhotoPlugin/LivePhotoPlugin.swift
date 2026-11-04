import Foundation
import Capacitor
import Photos
import AVFoundation
import ImageIO
import UniformTypeIdentifiers

/// Saves a still image and a short video to the photo library as one Live Photo,
/// so it can be set as a wallpaper. iOS pairs the two by a shared content
/// identifier: written into the still's Apple maker notes, and into the video's
/// QuickTime metadata along with a "still image time" marker.
@objc(LivePhotoPlugin)
public class LivePhotoPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LivePhotoPlugin"
    public let jsName = "LivePhoto"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)
    ]

    @objc func save(_ call: CAPPluginCall) {
        guard let photoB64 = call.getString("photo"), let photoData = Data(base64Encoded: photoB64),
              let videoB64 = call.getString("video"), let videoData = Data(base64Encoded: videoB64) else {
            call.reject("Send base64 'photo' (JPEG) and 'video' (MP4 or MOV).")
            return
        }
        let ext = call.getString("videoType") == "video/webm" ? "webm" : "mp4"
        let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do { try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true) } catch {
            call.reject("Couldn't make a temporary folder: \(error.localizedDescription)"); return
        }
        let inVideo = dir.appendingPathComponent("in.\(ext)")
        let outPhoto = dir.appendingPathComponent("live.jpg")
        let outVideo = dir.appendingPathComponent("live.mov")
        let assetId = UUID().uuidString

        do { try videoData.write(to: inVideo) } catch { call.reject("Couldn't save the video: \(error.localizedDescription)"); return }
        guard Self.writeStill(photoData, to: outPhoto, assetId: assetId) else {
            call.reject("Couldn't prepare the still image."); return
        }
        Self.writeVideo(from: inVideo, to: outVideo, assetId: assetId) { ok, message in
            guard ok else { call.reject(message ?? "Couldn't prepare the video."); return }
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                guard status == .authorized || status == .limited else {
                    call.reject("Allow Station to add to Photos in Settings to save wallpapers.", "PERMISSION")
                    return
                }
                PHPhotoLibrary.shared().performChanges({
                    let req = PHAssetCreationRequest.forAsset()
                    let opts = PHAssetResourceCreationOptions()
                    opts.shouldMoveFile = true
                    req.addResource(with: .photo, fileURL: outPhoto, options: opts)
                    req.addResource(with: .pairedVideo, fileURL: outVideo, options: opts)
                }) { success, error in
                    try? FileManager.default.removeItem(at: dir)
                    if success { call.resolve(["saved": true]) } else {
                        call.reject("Photos didn't accept it: \(error?.localizedDescription ?? "unknown error")")
                    }
                }
            }
        }
    }

    /// Re-encode the JPEG with the asset identifier in the Apple maker notes (key "17").
    static func writeStill(_ data: Data, to url: URL, assetId: String) -> Bool {
        guard let src = CGImageSourceCreateWithData(data as CFData, nil),
              let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else { return false }
        var props = (CGImageSourceCopyPropertiesAtIndex(src, 0, nil) as? [String: Any]) ?? [:]
        var maker = (props[kCGImagePropertyMakerAppleDictionary as String] as? [String: Any]) ?? [:]
        maker["17"] = assetId
        props[kCGImagePropertyMakerAppleDictionary as String] = maker
        CGImageDestinationAddImageFromSource(dest, src, 0, props as CFDictionary)
        return CGImageDestinationFinalize(dest)
    }

    /// Rewrite the clip as a QuickTime movie carrying the content identifier and a
    /// still-image-time marker in the middle, which is what iOS looks for.
    static func writeVideo(from input: URL, to output: URL, assetId: String, done: @escaping (Bool, String?) -> Void) {
        let asset = AVURLAsset(url: input)
        Task {
            do {
                guard let track = try await asset.loadTracks(withMediaType: .video).first else { done(false, "The clip has no video."); return }
                let duration = try await asset.load(.duration)
                let size = try await track.load(.naturalSize)
                let transform = try await track.load(.preferredTransform)

                let reader = try AVAssetReader(asset: asset)
                let readerOut = AVAssetReaderTrackOutput(track: track, outputSettings: [
                    kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
                ])
                reader.add(readerOut)

                let writer = try AVAssetWriter(outputURL: output, fileType: .mov)
                let idItem = AVMutableMetadataItem()
                idItem.keySpace = .quickTimeMetadata
                idItem.key = "com.apple.quicktime.content.identifier" as NSString
                idItem.value = assetId as NSString
                idItem.dataType = "com.apple.metadata.datatype.UTF-8"
                writer.metadata = [idItem]

                let videoIn = AVAssetWriterInput(mediaType: .video, outputSettings: [
                    AVVideoCodecKey: AVVideoCodecType.h264,
                    AVVideoWidthKey: Int(size.width),
                    AVVideoHeightKey: Int(size.height)
                ])
                videoIn.transform = transform
                videoIn.expectsMediaDataInRealTime = false
                writer.add(videoIn)

                // The still-image-time marker, as timed metadata.
                let spec: [String: Any] = [
                    kCMMetadataFormatDescriptionMetadataSpecificationKey_Identifier as String: "mdta/com.apple.quicktime.still-image-time",
                    kCMMetadataFormatDescriptionMetadataSpecificationKey_DataType as String: "com.apple.metadata.datatype.int8"
                ]
                var desc: CMFormatDescription?
                CMMetadataFormatDescriptionCreateWithMetadataSpecifications(allocator: kCFAllocatorDefault,
                    metadataType: kCMMetadataFormatType_Boxed, metadataSpecifications: [spec] as CFArray, formatDescriptionOut: &desc)
                let metaIn = AVAssetWriterInput(mediaType: .metadata, outputSettings: nil, sourceFormatHint: desc)
                let metaAdaptor = AVAssetWriterInputMetadataAdaptor(assetWriterInput: metaIn)
                writer.add(metaIn)

                guard reader.startReading(), writer.startWriting() else {
                    done(false, writer.error?.localizedDescription ?? reader.error?.localizedDescription ?? "Couldn't start writing."); return
                }
                writer.startSession(atSourceTime: .zero)

                let still = AVMutableMetadataItem()
                still.key = "com.apple.quicktime.still-image-time" as NSString
                still.keySpace = AVMetadataKeySpace(rawValue: "mdta")
                still.value = 0 as NSNumber
                still.dataType = "com.apple.metadata.datatype.int8"
                let mid = CMTimeMultiplyByFloat64(duration, multiplier: 0.5)
                metaAdaptor.append(AVTimedMetadataGroup(items: [still], timeRange: CMTimeRange(start: mid, duration: CMTime(value: 1, timescale: 100))))
                metaIn.markAsFinished()

                let queue = DispatchQueue(label: "station.livephoto.video")
                videoIn.requestMediaDataWhenReady(on: queue) {
                    while videoIn.isReadyForMoreMediaData {
                        if reader.status == .reading, let buffer = readerOut.copyNextSampleBuffer() {
                            if !videoIn.append(buffer) { reader.cancelReading() }
                        } else {
                            videoIn.markAsFinished()
                            writer.finishWriting {
                                done(writer.status == .completed, writer.error?.localizedDescription)
                            }
                            break
                        }
                    }
                }
            } catch {
                done(false, error.localizedDescription)
            }
        }
    }
}
