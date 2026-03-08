import { useFileTransferStore } from '../../store/file-transfer-store'
import { getFileTransferManager } from '../../services/FileTransferManager'
import './FileTransferProgress.css'

interface FileTransferProgressProps {
  chatId: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileTransferProgress({ chatId }: FileTransferProgressProps) {
  const transfers = useFileTransferStore((s) => s.getTransfersForChat(chatId))

  if (transfers.length === 0) return null

  return (
    <div className="file-transfer-list">
      {transfers.map((transfer) => (
        <div key={transfer.transferId} className="file-transfer-item">
          <div className="file-transfer-info">
            <span className="file-transfer-name">{transfer.fileName}</span>
            <span className="file-transfer-size">{formatSize(transfer.fileSize)}</span>
          </div>

          {transfer.status === 'transferring' && (
            <div className="file-transfer-progress-bar">
              <div
                className="file-transfer-progress-fill"
                style={{ width: `${transfer.progress}%` }}
              />
            </div>
          )}

          {transfer.status === 'pending' && transfer.direction === 'receive' && (
            <div className="file-transfer-actions">
              <button
                className="file-transfer-btn"
                onClick={() => getFileTransferManager().acceptFile(transfer.transferId)}
              >
                Accept
              </button>
              <button
                className="file-transfer-btn file-transfer-btn-danger"
                onClick={() => getFileTransferManager().rejectFile(transfer.transferId)}
              >
                Reject
              </button>
            </div>
          )}

          {transfer.status === 'pending' && transfer.direction === 'send' && (
            <span className="file-transfer-status">Waiting...</span>
          )}

          {transfer.status === 'completed' && transfer.blobUrl && (
            <a
              className="file-transfer-download"
              href={transfer.blobUrl}
              download={transfer.fileName}
            >
              Download
            </a>
          )}

          {transfer.status === 'completed' && !transfer.blobUrl && (
            <span className="file-transfer-status">Sent</span>
          )}

          {transfer.status === 'rejected' && (
            <span className="file-transfer-status">Rejected</span>
          )}

          {transfer.status === 'failed' && (
            <span className="file-transfer-status">Failed</span>
          )}
        </div>
      ))}
    </div>
  )
}
