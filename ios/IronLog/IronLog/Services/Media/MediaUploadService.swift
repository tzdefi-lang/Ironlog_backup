import Foundation
import Supabase

@MainActor
final class MediaUploadService {
    static let shared = MediaUploadService()

    func upload(data: Data, contentType: String, path: String) async throws -> URL {
        _ = try await SupabaseClientProvider.shared.client.storage
            .from("media")
            .upload(path: path, file: data, options: FileOptions(cacheControl: "3600", contentType: contentType, upsert: true))

        let publicURL = try SupabaseClientProvider.shared.client.storage
            .from("media")
            .getPublicURL(path: path)

        return publicURL
    }

    func upload(data: Data, path: String, contentType: String) async throws -> String {
        try await upload(data: data, contentType: contentType, path: path).absoluteString
    }

    func upload(data: Data, path: String) async throws -> String {
        let mime: String
        switch URL(fileURLWithPath: path).pathExtension.lowercased() {
        case "jpg", "jpeg":
            mime = "image/jpeg"
        case "png":
            mime = "image/png"
        case "gif":
            mime = "image/gif"
        case "mov":
            mime = "video/quicktime"
        case "mp4":
            mime = "video/mp4"
        default:
            mime = "application/octet-stream"
        }
        return try await upload(data: data, path: path, contentType: mime)
    }
}
