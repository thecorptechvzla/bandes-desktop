import {
  Injectable,
  ConflictException,
  RequestTimeoutException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SerialPort } from 'serialport';
import { ReadlineParser } from '@serialport/parser-readline';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_TIMEOUT_MS = 5000;

interface ScaleConfig {
  scalePort?: string;
  baudRate?: number;
}

@Injectable()
export class ScaleService {
  /**
   * Orden de resolución del puerto de la balanza:
   * 1. process.env.SCALE_PORT        (runtime, sin .env distribuido)
   * 2. bandes.config.json (junto al ejecutable; opcional, por cliente)
   * 3. Default: COM3 en Windows / /dev/ttyUSB0 en Linux
   */
  private resolveConfig(): ScaleConfig {
    try {
      const configFile = resolve('bandes.config.json');
      if (existsSync(configFile)) {
        const parsed = JSON.parse(readFileSync(configFile, 'utf-8')) as ScaleConfig;
        return {
          scalePort: parsed.scalePort ?? undefined,
          baudRate: parsed.baudRate ?? undefined,
        };
      }
    } catch {
      // config inválida: seguir con env/default
    }
    return {};
  }

  async readWeight(): Promise<{ weight: number }> {
    const file = this.resolveConfig();
    const isWin = process.platform === 'win32';
    const path =
      process.env.SCALE_PORT ||
      file.scalePort ||
      (isWin ? 'COM3' : '/dev/ttyUSB0');
    const baudRate =
      Number(process.env.SCALE_BAUD_RATE || file.baudRate || '9600');

    return new Promise<{ weight: number }>((resolve, reject) => {
      const port = new SerialPort({ path, baudRate, autoOpen: false });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));
      let timer: NodeJS.Timeout | null = null;
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        try {
          port.close(() => {});
        } catch {
          // puerto ya cerrado
        }
        fn();
      };

      timer = setTimeout(() => {
        finish(() =>
          reject(
            new RequestTimeoutException(
              'La báscula no respondió en los 5 segundos esperados',
            ),
          ),
        );
      }, DEFAULT_TIMEOUT_MS);

      parser.on('data', (line: string) => {
        const value = parseFloat(String(line).trim());
        if (Number.isNaN(value)) return; // línea no numérica: seguir esperando
        finish(() => resolve({ weight: value }));
      });

      port.on('error', (err) => {
        const code = (err as NodeJS.ErrnoException).code;
        if (code === 'EAGAIN' || code === 'EBUSY') {
          finish(() => reject(new ConflictException('El puerto serial está ocupado')));
        } else if (code === 'ENOENT') {
          finish(() =>
            reject(new ServiceUnavailableException('Puerto de la báscula no encontrado')),
          );
        } else {
          finish(() =>
            reject(
              new ServiceUnavailableException(`No se pudo abrir la báscula: ${err.message}`),
            ),
          );
        }
      });

      port.open(() => {}); // los errores llegan por el evento 'error'
    });
  }
}
