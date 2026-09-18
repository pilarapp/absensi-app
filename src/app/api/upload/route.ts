import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { verifyCaller } from "@/lib/auth-server";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "application/pdf",
]);

const ALLOWED_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "pdf"]);
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 Megabytes

function sanitizeFileName(originalName: string): string {
  // Ambil hanya nama file tanpa path traversal
  const baseName = originalName.replace(/^.*[\\\/]/, '');
  // Bersihkan karakter aneh kecuali huruf, angka, strip, underscore, dan titik
  const sanitized = baseName.replace(/[^a-zA-Z0-9.\-_]/g, '-');
  return `${Date.now()}-${sanitized}`;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Verifikasi Autentikasi Pengguna
    const caller = await verifyCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Akses Ditolak: Anda harus login untuk mengunggah file." },
        { status: 401 }
      );
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Tidak ada file yang diunggah." }, { status: 400 });
    }

    // 2. Validasi Tipe dan Ukuran File
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Ukuran file "${file.name}" melebihi batas maksimum 5MB.` },
          { status: 400 }
        );
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return NextResponse.json(
          { error: `Ekstensi file .${ext} tidak diizinkan. Hanya JPG, PNG, WEBP, dan PDF yang didukung.` },
          { status: 400 }
        );
      }

      if (!ALLOWED_MIME_TYPES.has(file.type.toLowerCase())) {
        return NextResponse.json(
          { error: `Format file ${file.type} tidak didukung atau tidak valid.` },
          { status: 400 }
        );
      }
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      return NextResponse.json(
        { 
          error: "Konfigurasi Cloudflare R2 belum diatur. Harap lengkapi variabel R2_... di environment." 
        }, 
        { status: 500 }
      );
    }

    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    const uploadedFiles = [];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const safeName = sanitizeFileName(file.name);

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: safeName,
          Body: buffer,
          ContentType: file.type,
        })
      );

      uploadedFiles.push({
        name: file.name,
        url: `${publicUrl}/${safeName}`,
      });
    }

    return NextResponse.json({ 
      message: "File berhasil diunggah ke Cloudflare R2", 
      files: uploadedFiles 
    });
    
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message || "Gagal mengunggah file." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    // 1. Verifikasi Autentikasi Pengguna
    const caller = await verifyCaller(req);
    if (!caller) {
      return NextResponse.json(
        { error: "Akses Ditolak: Anda harus login untuk menghapus file." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL file wajib diisi." }, { status: 400 });
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return NextResponse.json(
        { error: "Konfigurasi Cloudflare R2 belum lengkap." },
        { status: 500 }
      );
    }

    // Ekstrak nama file (key) dari URL
    let fileKey = "";
    if (publicUrl && url.includes(publicUrl)) {
      fileKey = url.replace(`${publicUrl}/`, "");
    } else {
      try {
        const parsed = new URL(url);
        fileKey = parsed.pathname.replace(/^\/+/, "");
      } catch {
        fileKey = url.split("/").pop() || "";
      }
    }

    fileKey = decodeURIComponent(fileKey);

    if (!fileKey || fileKey.includes("..") || fileKey.startsWith("/")) {
      return NextResponse.json({ error: "Key file tidak valid." }, { status: 400 });
    }

    const s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKeyId,
        secretAccessKey: secretAccessKey,
      },
    });

    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
      })
    );

    return NextResponse.json({ 
      success: true, 
      message: `File ${fileKey} berhasil dihapus dari Cloudflare R2.` 
    });
  } catch (error: any) {
    console.error("Delete file error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus file." }, { status: 500 });
  }
}
