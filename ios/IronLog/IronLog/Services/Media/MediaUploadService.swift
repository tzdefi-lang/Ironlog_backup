import Foundation
import Supabase

@MainActor
final class MediaUploadService {
    static let shared = MediaUploadService()
    private let maxAttempts = 4

    func upload(data: Data, contentType: String, path: String) async throws -> URL {
        var attempt = 0
        var delaySeconds = 1.0
        var lastError: Error?

        while attempt < maxAttempts {
            do {
                _ = try await SupabaseClientProvider.shared.client.storage
                    .from("media")
                    .upload(path: path, file: data, options: FileOptions(cacheControl: "3600", contentType: contentType, upsert: true))

                let publicURL = try SupabaseClientProvider.shared.client.storage
                    .from("media")
                    .getPublicURL(path: path)
                return publicURL
            } catch {
                lastError = error
                let retryable = isRetryable(error)
                let isLastAttempt = attempt == maxAttempts - 1

                AppLogger.media.error("Upload attempt \(attempt + 1, privacy: .public) failed for \(path, privacy: .public): \((error as NSError).localizedDescription, privacy: .public)")

                guard retryable, !isLastAttempt else {
                    throw error
                }

                AppLogger.media.log("Retrying upload in \(delaySeconds, privacy: .public)s")
                try await Task.sleep(for: .seconds(delaySeconds))
                delaySeconds *= 2
                attempt += 1
                continue
            }
        }

        throw lastError ?? URLError(.cannotConnectToHost)
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

    private func isRetryable(_ error: Error) -> Bool {
        if error is URLError {
            return true
        }

        let nsError = error as NSError
        if nsError.domain == NSURLErrorDomain {
            return true
        }

        if (500 ... 599).contains(nsError.code) {
            return true
        }

        let message = "\(error) \(nsError.localizedDescription)".lowercased()
        return message.contains("timeout")
            || message.contains("connection")
            || message.contains("offline")
            || message.contains("temporar")
    }
}
