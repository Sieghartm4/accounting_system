const { Query } = require('../database/util/queries.util')
const { logger } = require('./logger.util')

const isValidId = (value) => /^\d+$/.test(String(value || ''))

const wantsMetadataOnly = (req) =>
  String(req?.query?.includeAttachments || '').toLowerCase() === 'false'

const toAttachmentMetadata = (attachment = {}) => {
  const file = attachment.file ?? attachment.File ?? null
  const metadata = { ...attachment }

  delete metadata.file
  delete metadata.File

  return {
    ...metadata,
    has_file: Boolean(file),
    file_size: file
      ? Buffer.isBuffer(file)
        ? file.length
        : String(file).length
      : 0,
  }
}

const metadataOnly = (attachments, req) =>
  wantsMetadataOnly(req)
    ? (attachments || []).map(toAttachmentMetadata)
    : attachments

const createAttachmentFileHandler = ({
  table,
  idColumn,
  documentColumn,
  fileColumn,
  nameColumn,
  label,
}) => {
  return async (req, res) => {
    try {
      const attachmentId = req.params.attachmentId
      const documentId = req.params.id

      if (!isValidId(attachmentId) || !isValidId(documentId)) {
        return res.status(400).json({
          success: false,
          message: `Invalid ${label} attachment identifier`,
        })
      }

      const query = `SELECT \`${idColumn}\` AS id, \`${nameColumn}\` AS name, \`${fileColumn}\` AS file FROM \`${table}\` WHERE \`${idColumn}\` = ? AND \`${documentColumn}\` = ? LIMIT 1`
      const rows = await Query(query, [attachmentId, documentId])

      if (!rows || rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: `${label} attachment not found`,
        })
      }

      return res.status(200).json({
        success: true,
        data: rows[0],
      })
    } catch (error) {
      logger.error(`Error fetching ${label} attachment file:`, error)
      return res.status(500).json({
        success: false,
        message: `Server error while fetching ${label} attachment file`,
        error:
          process.env.NODE_ENV === 'development'
            ? error.message
            : 'Internal server error',
      })
    }
  }
}

module.exports = {
  createAttachmentFileHandler,
  isValidId,
  metadataOnly,
  wantsMetadataOnly,
}
