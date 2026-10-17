// Bookoo Mini driver for scales whose firmware advertises "OOKOO…" instead of
// "BOOKOO…". Protocol ported from Decaid's native BookooScale
// (lib/src/models/device/impl/bookoo/miniscale.dart).
function createPlugin(host) {
  const service = "00000ffe-0000-1000-8000-00805f9b34fb";
  const dataCharacteristic = "0000ff11-0000-1000-8000-00805f9b34fb";
  const commandCharacteristic = "0000ff12-0000-1000-8000-00805f9b34fb";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  function decodeBase64(data) {
    if (typeof data !== "string" || data.length % 4 !== 0) return null;
    const bytes = [];
    for (let i = 0; i < data.length; i += 4) {
      const a = alphabet.indexOf(data[i]);
      const b = alphabet.indexOf(data[i + 1]);
      const c = data[i + 2] === "=" ? 0 : alphabet.indexOf(data[i + 2]);
      const d = data[i + 3] === "=" ? 0 : alphabet.indexOf(data[i + 3]);
      if (a < 0 || b < 0 || c < 0 || d < 0) return null;
      bytes.push((a << 2) | (b >> 4));
      if (data[i + 2] !== "=") bytes.push(((b & 15) << 4) | (c >> 2));
      if (data[i + 3] !== "=") bytes.push(((c & 3) << 6) | d);
    }
    return bytes;
  }

  function encodeBase64(bytes) {
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const b0 = bytes[i];
      const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
      const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      out += alphabet[b0 >> 2];
      out += alphabet[((b0 & 3) << 4) | (b1 >> 4)];
      out += i + 1 < bytes.length ? alphabet[((b1 & 15) << 2) | (b2 >> 6)] : "=";
      out += i + 2 < bytes.length ? alphabet[b2 & 63] : "=";
    }
    return out;
  }

  // 20-byte frame: 03 0B … sign at [6] ('+'/'-'), weight in 1/100 g at [7..9],
  // battery % at [13], XOR checksum of bytes 0..18 at [19].
  function parseFrame(data) {
    const b = decodeBase64(data);
    if (!b || b.length !== 20 || b[0] !== 0x03 || b[1] !== 0x0b) return null;
    if (b[6] !== 0x2b && b[6] !== 0x2d) return null;
    let checksum = 0;
    for (let i = 0; i < 19; i++) checksum ^= b[i];
    if (checksum !== b[19]) return null;
    let weight = ((b[7] << 16) | (b[8] << 8) | b[9]) / 100;
    if (b[6] === 0x2d) weight = -weight;
    const battery = b[13] <= 100 ? b[13] : null;
    return {weight, battery};
  }

  function command(opcode) {
    const bytes = [0x03, 0x0a, opcode, 0x00, 0x00];
    bytes.push(bytes.reduce((acc, x) => acc ^ x, 0));
    return encodeBase64(bytes);
  }

  return {
    id: "bookoo-ookoo.reaplugin",
    onLoad() {
      return host.devices.bindDriver("bookoo-ookoo", {
        create() {
          let active = null;

          function send(opcode) {
            const state = active;
            if (!state || state.stopped) {
              return Promise.reject(new Error("Bookoo session is not connected"));
            }
            return state.session.gatt.writeWithResponse(
              service, commandCharacteristic, command(opcode));
          }

          return {
            async connect(session) {
              const state = {session, stopped: false, battery: null};
              active = state;
              let settle;
              const firstWeight = new Promise((resolve, reject) => {
                settle = {resolve, reject, done: false};
              });
              firstWeight.catch(() => {});
              const finish = (error) => {
                if (settle.done) return;
                settle.done = true;
                error ? settle.reject(error) : settle.resolve();
              };
              try {
                const services = await session.gatt.discoverServices();
                if (!services.includes(service)) {
                  throw new Error("Bookoo service 0x0FFE not found");
                }
                session.gatt.onDisconnect(() => {
                  state.stopped = true;
                  finish(new Error("Bookoo disconnected before first weight"));
                });
                await session.gatt.subscribe(service, dataCharacteristic, async (data, sample) => {
                  if (state.stopped || active !== state) return;
                  const frame = parseFrame(data);
                  if (!frame) return;
                  if (frame.battery !== null) state.battery = frame.battery;
                  try {
                    await session.publish({weight: frame.weight, battery: state.battery}, sample);
                    finish();
                  } catch (error) {
                    finish(error);
                  }
                });
                await firstWeight;
              } catch (error) {
                state.stopped = true;
                finish(error);
                throw error;
              }
            },
            disconnect() {
              if (active) active.stopped = true;
              active = null;
            },
            tare() { return send(0x01); },
            startTimer() { return send(0x04); },
            stopTimer() { return send(0x05); },
            resetTimer() { return send(0x06); },
          };
        },
      });
    },
    onUnload() {},
  };
}

if (typeof module !== "undefined") module.exports = {createPlugin};
