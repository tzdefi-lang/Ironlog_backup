import AVKit
import SwiftUI

struct GifVideoPlayer: View {
    let url: URL

    @State private var player: AVPlayer?
    @State private var loopObserver: NSObjectProtocol?

    var body: some View {
        Group {
            if let player {
                VideoPlayer(player: player)
                    .frame(height: 220)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            } else {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color.botanicalMuted)
                    .frame(height: 220)
            }
        }
        .onAppear {
            if player == nil {
                configurePlayer(for: url)
            }
        }
        .onChange(of: url) { _, newURL in
            configurePlayer(for: newURL)
        }
        .onDisappear {
            teardownPlayer()
        }
    }

    private func configurePlayer(for url: URL) {
        teardownPlayer()

        // Build the player item off the main thread to avoid blocking UI
        let item = AVPlayerItem(url: url)
        let newPlayer = AVPlayer(playerItem: item)
        newPlayer.isMuted = true

        loopObserver = NotificationCenter.default.addObserver(
            forName: .AVPlayerItemDidPlayToEndTime,
            object: item,
            queue: .main
        ) { [weak newPlayer] _ in
            newPlayer?.seek(to: .zero)
            newPlayer?.play()
        }

        newPlayer.play()
        player = newPlayer
    }

    private func teardownPlayer() {
        player?.pause()
        if let loopObserver {
            NotificationCenter.default.removeObserver(loopObserver)
            self.loopObserver = nil
        }
        player = nil
    }
}
