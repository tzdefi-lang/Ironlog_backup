import SwiftUI

extension Font {
    static func display(_ size: CGFloat) -> Font {
        .custom("PlayfairDisplay-SemiBold", size: size)
    }

    static func botanicalBody(_ size: CGFloat) -> Font {
        .custom("SourceSans3-Regular", size: size)
    }

    static func botanicalSemibold(_ size: CGFloat) -> Font {
        .custom("SourceSans3-SemiBold", size: size)
    }
}
