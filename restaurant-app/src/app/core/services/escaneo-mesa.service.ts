import { Injectable } from '@angular/core';
import {
  BarcodeFormat,
  BarcodeScanner,
} from '@capacitor-mlkit/barcode-scanning';

export interface ResultadoEscaneoMesa {
  ok: boolean;
  cancelado?: boolean;
  mensaje?: string;
  mesaId?: string;
}

@Injectable({
  providedIn: 'root',
})
export class EscaneoMesaService {

  private escaneando = false;

  async escanear(): Promise<ResultadoEscaneoMesa> {

  console.log('[QR SERVICE] 1. Entró al servicio');

  if (this.escaneando) {
    console.log('[QR SERVICE] 2. Ya estaba escaneando');
    return {
      ok: false,
      cancelado: true,
    };
  }

  this.escaneando = true;

  console.log('[QR SERVICE] 3. Pidiendo permiso de cámara');

  try {

    const permiso = await BarcodeScanner.requestPermissions();

    console.log(
      '[QR SERVICE] 4. Resultado permiso:',
      permiso
    );

    if (
      permiso.camera !== 'granted' &&
      permiso.camera !== 'limited'
    ) {
      console.log('[QR SERVICE] 5. Cámara NO autorizada');

      return {
        ok: false,
        mensaje:
          'Necesitamos permiso de cámara para escanear el código.',
      };
    }

    console.log('[QR SERVICE] 6. Cámara autorizada');

    document.body.classList.add('barcode-scanner-active');

    console.log('[QR SERVICE] 7. Clase barcode-scanner-active agregada');

    return await new Promise<ResultadoEscaneoMesa>(
      async (resolve) => {

        console.log('[QR SERVICE] 8. Creando Promise del scanner');

        let finalizado = false;

        const finalizar = async (
          resultado: ResultadoEscaneoMesa
        ) => {
          console.log(
            '[QR SERVICE] 9. Finalizando scanner:',
            resultado
          );

          if (finalizado) return;

          finalizado = true;

          try {
            console.log('[QR SERVICE] 10. Removiendo listener');

            await listener?.remove();

            console.log('[QR SERVICE] 11. Ejecutando stopScan');

            await BarcodeScanner.stopScan();

          } catch (error) {
            console.error(
              '[QR SERVICE] ERROR cerrando scanner:',
              error
            );
          }

          document.body.classList.remove(
            'barcode-scanner-active'
          );

          this.escaneando = false;

          console.log(
            '[QR SERVICE] 12. Resolviendo resultado'
          );

          resolve(resultado);
        };

        const listener =
          await BarcodeScanner.addListener(
            'barcodesScanned',
            async (event) => {

              console.log(
                '[QR SERVICE] 13. EVENTO barcodeScanned:',
                event
              );

              const barcode = event.barcodes?.[0];

              if (!barcode) {
                console.log(
                  '[QR SERVICE] 14. No se encontró barcode'
                );
                return;
              }

              const raw = (
                barcode.rawValue ?? ''
              ).trim();

              console.log(
                '[QR SERVICE] 15. QR leído:',
                raw
              );

              if (!raw) return;

              const partes = raw
                .split('/')
                .filter(Boolean);

              const mesaId =
                partes[partes.length - 1];

              console.log(
                '[QR SERVICE] 16. Mesa ID:',
                mesaId
              );

              const esUuid =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                  .test(mesaId ?? '');

              console.log(
                '[QR SERVICE] 17. ¿Es UUID?',
                esUuid
              );

              if (!esUuid) {
                await finalizar({
                  ok: false,
                  mensaje:
                    'Ese código QR no corresponde a una mesa.',
                });

                return;
              }

              await finalizar({
                ok: true,
                mesaId,
              });
            }
          );

        console.log(
          '[QR SERVICE] 18. Listener creado'
        );

        try {

          console.log(
            '[QR SERVICE] 19. EJECUTANDO BarcodeScanner.startScan()'
          );

          await BarcodeScanner.startScan({
            formats: [BarcodeFormat.QrCode],
          });

          console.log(
            '[QR SERVICE] 20. startScan() terminó'
          );

        } catch (error) {

          console.error(
            '[QR SERVICE] ERROR EN startScan():',
            error
          );

          await finalizar({
            ok: false,
            mensaje:
              'No se pudo abrir la cámara.',
          });
        }
      }
    );

  } catch (error) {

    console.error(
      '[QR SERVICE] ERROR GENERAL:',
      error
    );

    this.escaneando = false;

    document.body.classList.remove(
      'barcode-scanner-active'
    );

    return {
      ok: false,
      mensaje:
        'No se pudo escanear el código.',
    };
  }
}

}