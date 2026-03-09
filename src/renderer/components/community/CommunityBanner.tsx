import './CommunityBanner.css'

interface CommunityBannerProps {
  serverName: string
  channelName: string
}

export function CommunityBanner({ serverName, channelName }: CommunityBannerProps) {
  return (
    <div className="community-banner">
      <span className="community-banner-path">
        {serverName} &gt; #{channelName}
      </span>
      <span className="community-banner-warning">
        Messages are stored on the community server. Ephemeral messages are not available.
      </span>
    </div>
  )
}
