type TarFileOptions = {
    ownerUserId?: number,
    groupUserId?: number,
    user?: string,
    group?: string,
};


class TarFile {
    name: string;
    bytes: Uint8Array;
    mode: number;
    options: TarFileOptions;

    constructor(name: string, bytes: Uint8Array, mode: number, options: TarFileOptions) {
        this.name = name;
        this.bytes = bytes;
        this.mode = mode;
        this.options = options;
    }

    public toBytes(dest: Uint8Array) {
        const nameBytes = TarFile.encode(this.name);
        dest.set(nameBytes.length < 100 ? nameBytes : nameBytes.slice(0, 99), 0);

        dest.set(TarFile.numberToBytes(this.mode, 8), 100);  // file mode
        dest.set(TarFile.numberToBytes(this.options.ownerUserId || 0, 8), 108);  // Owner's numeric user ID
        dest.set(TarFile.numberToBytes(this.options.groupUserId || 0, 8), 116);  // Group's numeric user ID
        dest.set(TarFile.numberToBytes(this.bytes.length, 13), 124);  // File size in bytes (octal base)
        dest.set(TarFile.numberToBytes(Date.now() / 1000 | 0, 12), 136);  // Last modification time in numeric Unix time format (octal)
        dest.set(TarFile.encode('        '), 148);  // Checksum for header record
        dest[156] = 48;  // Link indicator (file type)
        // bytes.set(this.numberToBytes(0, 12), 157);  // Name of linked file
        dest.set(TarFile.encode('ustar'), 257);
        dest.set(TarFile.encode('00'), 263);
        dest.set(TarFile.encode(this.options.user || ''), 265);
        dest.set(TarFile.encode(this.options.group || ''), 297);
        dest.set(TarFile.encode('000000 '), 329);
        dest.set(TarFile.encode('000000 '), 337);

        // finally compute the checksum
        const checksum = dest.reduce((x, y) => x + y);
        dest.set(TarFile.numberToBytes(checksum, 8), 148);
        dest[155] = 0;

        // set the actual file content
        dest.set(this.bytes, 512);
    }

    public totalBytes(): number {
        return Math.ceil(this.bytes.length / 512.0) * 512 + 512;
    }

    private static numberToBytes(x: number, totalLength: number): Uint8Array {
        return TarFile.textEncoder.encode(x.toString(8).padStart(totalLength - 2, '0') + ' ');
    }

    private static textEncoder = new TextEncoder();

    private static encode(x: string) {
        return TarFile.textEncoder.encode(x);
    }
}


class Tar {
    files: TarFile[];

    constructor() {
        this.files = [];
    }

    public add(name: string, bytes: Uint8Array, mode: number = 0o644, options: TarFileOptions = {}) {
        this.files.push(new TarFile(name, bytes, mode, options));
    }

    public toBytes(): Uint8Array {
        const filesTotalBytes = this.files.map(f => f.totalBytes());
        const totalBytes = 1024 + filesTotalBytes.reduce((x, y) => x + y);

        const bytes = new Uint8Array(totalBytes);
        let offset = 0;
        for (let i = 0; i < this.files.length; i++) {
            const fileBytesDest = bytes.subarray(offset, filesTotalBytes[i]);
            this.files[i].toBytes(fileBytesDest);
            offset += filesTotalBytes[i];
        }
        return bytes;
    }
}
