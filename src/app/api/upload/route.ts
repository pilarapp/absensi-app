import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: "Tidak ada file yang diunggah" }, { status: 400 });
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.R2_BUCKET_NAME;
    const publicUrl = process.env.R2_PUBLIC_URL;

    // Untuk pengembangan lokal, beritahu pengguna jika kredensial belum ada
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
      return NextResponse.json(
        { 
          error: "Konfigurasi Cloudflare R2 belum diatur. Harap isi variabel R2_... di file .env" 
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

    // Loop untuk mengunggah setiap file ke R2
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

      await s3Client.send(
        new PutObjectCommand({
          Bucket: bucketName,
          Key: fileName,
          Body: buffer,
          ContentType: file.type,
        })
      );

      // Cloudflare R2 (jika di-set public access)
      uploadedFiles.push({
        name: file.name,
        url: `${publicUrl}/${fileName}`,
      });
    }

    return NextResponse.json({ 
      message: "File berhasil diunggah ke Cloudflare R2", 
      files: uploadedFiles 
    });
    
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url) {
      return NextResponse.json({ error: "URL file wajib diisi" }, { status: 400 });
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

    if (!fileKey) {
      return NextResponse.json({ error: "Key file tidak valid" }, { status: 400 });
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
      message: `File ${fileKey} berhasil dihapus dari Cloudflare R2` 
    });
  } catch (error: any) {
    console.error("Delete file error:", error);
    return NextResponse.json({ error: error.message || "Gagal menghapus file" }, { status: 500 });
  }
}
