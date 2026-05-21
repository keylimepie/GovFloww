// =============================================
// File Preview Modal — In-browser document viewer
// =============================================
// Supports: PDF, Images, DOCX, TXT/XML, SVG
// Fallback: Download link for unsupported formats (CAD, ZIP, etc.)

import { useEffect, useRef, useState } from 'react';
import { Modal, Spin, Typography, Button, Space, Tag, Alert, Table, Tabs } from 'antd';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileUnknownOutlined,
  FileWordOutlined,
  ExpandOutlined,
} from '@ant-design/icons';

const { Text, Title } = Typography;

// ---- File type classification ----

type PreviewType = 'pdf' | 'image' | 'text' | 'docx' | 'spreadsheet' | 'svg' | 'unsupported';

const MIME_MAP: Record<string, PreviewType> = {
  'application/pdf': 'pdf',
  // Images
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/bmp': 'image',
  'image/webp': 'image',
  'image/tiff': 'image',
  'image/svg+xml': 'svg',
  // Text
  'text/plain': 'text',
  'text/csv': 'spreadsheet',
  'text/xml': 'text',
  'application/xml': 'text',
  // Office
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'spreadsheet',
  'application/vnd.ms-excel': 'unsupported',
  'application/vnd.oasis.opendocument.spreadsheet': 'unsupported',
  'application/vnd.oasis.opendocument.text': 'unsupported', // ODT - limited support
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'unsupported',
  // CAD
  'application/acad': 'unsupported',
  'image/vnd.dwg': 'unsupported',
  'image/vnd.dxf': 'unsupported',
  // Compressed
  'application/zip': 'unsupported',
  'application/x-rar-compressed': 'unsupported',
};

const EXT_MAP: Record<string, PreviewType> = {
  pdf: 'pdf',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', bmp: 'image', webp: 'image', tiff: 'image', tif: 'image',
  svg: 'svg',
  txt: 'text', xml: 'text',
  csv: 'spreadsheet', xls: 'unsupported', xlsx: 'spreadsheet', ods: 'unsupported',
  docx: 'docx', doc: 'unsupported', odt: 'unsupported',
  pptx: 'unsupported', ppt: 'unsupported',
  dwg: 'unsupported', dxf: 'unsupported', dgn: 'unsupported',
  zip: 'unsupported', rar: 'unsupported',
};

function getPreviewType(mimeType: string, fileName: string): PreviewType {
  if (MIME_MAP[mimeType]) return MIME_MAP[mimeType];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return EXT_MAP[ext] || 'unsupported';
}

function getFileIcon(type: PreviewType) {
  switch (type) {
    case 'pdf': return <FilePdfOutlined style={{ color: '#e74c3c' }} />;
    case 'image': case 'svg': return <FileImageOutlined style={{ color: '#3498db' }} />;
    case 'docx': return <FileWordOutlined style={{ color: '#2980b9' }} />;
    case 'spreadsheet': return <FileExcelOutlined style={{ color: '#27ae60' }} />;
    case 'text': return <FileTextOutlined style={{ color: '#8e44ad' }} />;
    default: return <FileUnknownOutlined />;
  }
}

// ---- Preview Renderers ----

function PdfPreview({ url }: { url: string }) {
  return (
    <iframe
      src={url}
      style={{ width: '100%', height: '75vh', border: 'none', borderRadius: 8 }}
      title="PDF Preview"
    />
  );
}

function ImagePreview({ url, fileName }: { url: string; fileName: string }) {
  const [fullscreen, setFullscreen] = useState(false);

  return (
    <>
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <img
          src={url}
          alt={fileName}
          style={{
            maxWidth: '100%',
            maxHeight: '70vh',
            objectFit: 'contain',
            borderRadius: 8,
            cursor: 'zoom-in',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
          onClick={() => setFullscreen(true)}
        />
        <div style={{ marginTop: 8 }}>
          <Button icon={<ExpandOutlined />} size="small" onClick={() => setFullscreen(true)}>
            Full Size
          </Button>
        </div>
      </div>
      <Modal
        open={fullscreen}
        footer={null}
        onCancel={() => setFullscreen(false)}
        width="95vw"
        style={{ top: 10 }}
        destroyOnClose
      >
        <img
          src={url}
          alt={fileName}
          style={{ width: '100%', objectFit: 'contain' }}
        />
      </Modal>
    </>
  );
}

function SvgPreview({ url }: { url: string }) {
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then(setSvgContent)
      .catch(() => setSvgContent(null))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) return <Spin tip="Loading SVG..." />;
  if (!svgContent) return <Alert type="error" message="Failed to load SVG" />;

  return (
    <div
      style={{
        textAlign: 'center',
        padding: 16,
        background: '#fafafa',
        borderRadius: 8,
        maxHeight: '70vh',
        overflow: 'auto',
      }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(url)
      .then((res) => res.text())
      .then(setContent)
      .catch(() => setContent(null))
      .finally(() => setLoading(false));
  }, [url]);

  if (loading) return <Spin tip="Loading file..." />;
  if (content === null) return <Alert type="error" message="Failed to load file content" />;

  return (
    <pre
      style={{
        background: '#1e1e2e',
        color: '#cdd6f4',
        padding: 20,
        borderRadius: 8,
        maxHeight: '70vh',
        overflow: 'auto',
        fontSize: 13,
        lineHeight: 1.6,
        fontFamily: "'Fira Code', 'Consolas', monospace",
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {content}
    </pre>
  );
}

function DocxPreview({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const docxPreview = await import('docx-preview');

        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = '';
        await docxPreview.renderAsync(blob, containerRef.current, undefined, {
          className: 'docx-preview-wrapper',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          experimental: false,
          trimXmlDeclaration: true,
          useBase64URL: true,
        });
      } catch (e) {
        if (!cancelled) setError('Failed to render document. Try downloading instead.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url]);

  if (error) return <Alert type="warning" message={error} />;

  return (
    <div style={{ position: 'relative' }}>
      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="Rendering document..." />
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          maxHeight: '75vh',
          overflow: 'auto',
          background: '#fff',
          borderRadius: 8,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        }}
      />
    </div>
  );
}

function SpreadsheetPreview({ url, fileName }: { url: string; fileName: string }) {
  const [sheetData, setSheetData] = useState<Record<string, string[][]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const extension = fileName.split('.').pop()?.toLowerCase();
        const response = await fetch(url);
        const sheets: Record<string, string[][]> = {};

        if (extension === 'csv') {
          const text = await response.text();
          sheets.CSV = text
            .split(/\r?\n/)
            .filter((line) => line.length > 0)
            .map((line) => line.split(',').map((cell) => cell.trim()));
        } else {
          const ExcelJS = await import('exceljs');
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(await response.arrayBuffer());

          workbook.eachSheet((worksheet) => {
            const rows: string[][] = [];
            worksheet.eachRow((row) => {
              const values = Array.isArray(row.values) ? row.values.slice(1) : [];
              rows.push(values.map((value) => {
                if (value === null || value === undefined) return '';
                if (value instanceof Date) return value.toLocaleDateString();
                if (typeof value === 'object' && 'text' in value) return String((value as { text: unknown }).text);
                return String(value);
              }));
            });
            sheets[worksheet.name] = rows;
          });
        }

        if (!cancelled) setSheetData(sheets);
      } catch {
        if (!cancelled) setError('Failed to preview spreadsheet. Download the file to view it locally.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [url, fileName]);

  if (loading) return <Spin tip="Parsing spreadsheet..." />;
  if (error || !sheetData) return <Alert type="warning" message={error || 'Cannot preview spreadsheet'} />;

  const renderSheet = (name: string) => {
    const rows = sheetData[name] || [];
    if (rows.length === 0) return <Text type="secondary">Empty sheet</Text>;

    const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
    const columns = Array.from({ length: maxColumns }, (_, index) => ({
      title: String.fromCharCode(65 + (index % 26)),
      dataIndex: index,
      key: index,
      width: 160,
      ellipsis: true,
      render: (value: string) => <Text style={{ fontSize: 12 }}>{value || ''}</Text>,
    }));

    const dataSource = rows.map((row, rowIndex) => {
      const record: Record<string, string | number> = { key: rowIndex };
      row.forEach((cell, index) => { record[index] = cell; });
      return record;
    });

    return (
      <Table
        columns={columns}
        dataSource={dataSource}
        size="small"
        scroll={{ x: 'max-content', y: '55vh' }}
        pagination={{ pageSize: 100, showSizeChanger: true }}
        bordered
      />
    );
  };

  const sheetNames = Object.keys(sheetData);
  if (sheetNames.length === 1) return renderSheet(sheetNames[0]);

  return (
    <Tabs
      items={sheetNames.map((name) => ({
        key: name,
        label: name,
        children: renderSheet(name),
      }))}
    />
  );
}

function UnsupportedPreview({ fileName, url }: { fileName: string; url: string }) {
  const ext = fileName.split('.').pop()?.toUpperCase() || 'UNKNOWN';

  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <FileUnknownOutlined style={{ fontSize: 64, color: '#999', marginBottom: 16 }} />
      <Title level={4} style={{ marginBottom: 8 }}>
        Preview not available for .{ext} files
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        This file format cannot be previewed in the browser. You can download it to view locally.
      </Text>
      <Button
        type="primary"
        icon={<DownloadOutlined />}
        size="large"
        href={url}
        target="_blank"
        rel="noreferrer"
      >
        Download {fileName}
      </Button>
    </div>
  );
}

// ---- Main Modal Component ----

interface FilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  file: {
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    url: string | null;
    createdAt: string;
    uploader?: { firstName: string; lastName: string };
  } | null;
}

export default function FilePreviewModal({ open, onClose, file }: FilePreviewModalProps) {
  if (!file || !file.url) return null;

  const previewType = getPreviewType(file.mimeType, file.originalName);
  const icon = getFileIcon(previewType);
  const sizeLabel = file.sizeBytes > 1024 * 1024
    ? `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
    : `${(file.sizeBytes / 1024).toFixed(1)} KB`;

  const renderPreview = () => {
    switch (previewType) {
      case 'pdf':
        return <PdfPreview url={file.url!} />;
      case 'image':
        return <ImagePreview url={file.url!} fileName={file.originalName} />;
      case 'svg':
        return <SvgPreview url={file.url!} />;
      case 'text':
        return <TextPreview url={file.url!} />;
      case 'docx':
        return <DocxPreview url={file.url!} />;
      case 'spreadsheet':
        return <SpreadsheetPreview url={file.url!} fileName={file.originalName} />;
      default:
        return <UnsupportedPreview fileName={file.originalName} url={file.url!} />;
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Tag>{file.mimeType}</Tag>
          <Text type="secondary">{sizeLabel}</Text>
          {file.uploader && (
            <Text type="secondary">
              Uploaded by {file.uploader.firstName} {file.uploader.lastName}
            </Text>
          )}
          <Button icon={<DownloadOutlined />} href={file.url} target="_blank" rel="noreferrer">
            Download
          </Button>
        </Space>
      }
      title={
        <Space>
          {icon}
          <span>{file.originalName}</span>
        </Space>
      }
      width={previewType === 'spreadsheet' ? '95vw' : '80vw'}
      style={{ top: 20 }}
      destroyOnClose
      styles={{
        body: {
          padding: previewType === 'pdf' ? 0 : 16,
          maxHeight: '80vh',
          overflow: previewType === 'pdf' ? 'hidden' : 'auto',
        },
      }}
    >
      {renderPreview()}
    </Modal>
  );
}
