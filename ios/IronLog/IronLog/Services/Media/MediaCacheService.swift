import Foundation

final class MediaCacheService {
    private let cache = URLCache(memoryCapacity: 25 * 1024 * 1024, diskCapacity: 200 * 1024 * 1024)

    func cachedData(for request: URLRequest) -> Data? {
        cache.cachedResponse(for: request)?.data
    }

    func cache(data: Data, response: URLResponse, for request: URLRequest) {
        cache.storeCachedResponse(CachedURLResponse(response: response, data: data), for: request)
    }
}
