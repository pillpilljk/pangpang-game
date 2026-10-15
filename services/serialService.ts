
import { BITMAPS } from '../constants';
import { BoardInput } from '../types';

// Fix: Missing Web Serial API type definitions
interface SerialPort {
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  readable: ReadableStream<Uint8Array>;
}

class SerialService {
  // Fix: Use the local SerialPort interface to avoid type errors
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private onDataCallback: ((input: BoardInput) => void) | null = null;
  private onStatusCallback: ((connected: boolean) => void) | null = null;
  private lastPacketTime: number = 0;
  private statusCheckInterval: any = null;

  async connect() {
    try {
      // Fix: Cast navigator to any to access the 'serial' property which is missing in standard lib.dom
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      this.startReading();
      this.startStatusCheck();
      return true;
    } catch (err) {
      console.error('Serial Connection Error:', err);
      if (err instanceof DOMException && err.name === 'SecurityError') {
        alert('Security Error: Please check site settings for hardware access or use full-screen mode.');
      }
      return false;
    }
  }

  private async startReading() {
    if (!this.port) return;

    while (this.port.readable) {
      this.reader = this.port.readable.getReader();
      try {
        let buffer = new Uint8Array(0);
        while (true) {
          const { value, done } = await this.reader.read();
          if (done) break;
          
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          // Look for packet header 0xFF 0x55
          while (buffer.length >= 11) {
            let foundHeader = false;
            for (let i = 0; i <= buffer.length - 11; i++) {
              if (buffer[i] === 0xFF && buffer[i + 1] === 0x55) {
                const packet = buffer.slice(i, i + 11);
                this.decodePacket(packet);
                buffer = buffer.slice(i + 11);
                foundHeader = true;
                this.lastPacketTime = Date.now();
                break;
              }
            }
            if (!foundHeader) {
              // Discard first byte if not part of header to prevent infinite loop
              buffer = buffer.slice(1);
            }
          }
        }
      } catch (err) {
        console.error('Read error:', err);
      } finally {
        this.reader.releaseLock();
      }
    }
  }

  private decodePacket(packet: Uint8Array) {
    const data1 = packet[3];
    const data2 = packet[4];

    const input: BoardInput = {
      1: !!(data2 & BITMAPS.DATA2.LU),
      2: !!(data1 & BITMAPS.DATA1.UP),
      3: !!(data2 & BITMAPS.DATA2.RU),
      4: !!(data1 & BITMAPS.DATA1.LEFT),
      5: !!(data1 & BITMAPS.DATA1.CENTER),
      6: !!(data2 & BITMAPS.DATA2.RIGHT),
      7: !!(data2 & BITMAPS.DATA2.LD),
      8: !!(data1 & BITMAPS.DATA1.DOWN),
      9: !!(data2 & BITMAPS.DATA2.RD),
      SELECT: !!(data2 & BITMAPS.DATA2.SELECT),
      START: !!(data2 & BITMAPS.DATA2.START),
    };

    if (this.onDataCallback) this.onDataCallback(input);
  }

  private startStatusCheck() {
    this.statusCheckInterval = setInterval(() => {
      const isConnected = Date.now() - this.lastPacketTime < 1000 && !!this.port;
      if (this.onStatusCallback) this.onStatusCallback(isConnected);
    }, 500);
  }

  onData(cb: (input: BoardInput) => void) {
    this.onDataCallback = cb;
  }

  onStatusChange(cb: (connected: boolean) => void) {
    this.onStatusCallback = cb;
  }

  async disconnect() {
    if (this.reader) {
      await this.reader.cancel();
    }
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
    if (this.statusCheckInterval) clearInterval(this.statusCheckInterval);
    if (this.onStatusCallback) this.onStatusCallback(false);
  }
}

export const serialService = new SerialService();
