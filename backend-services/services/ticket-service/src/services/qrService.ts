export class QRCodeService {
  async generateQRCode(data: string): Promise<string> {
    // Simulate QR code generation
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==`;
  }
}
