import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "请选择图片文件" }, { status: 400 });
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        { error: "图床服务未配置，请联系管理员设置 CLOUDINARY_CLOUD_NAME 和 CLOUDINARY_UPLOAD_PRESET" },
        { status: 500 }
      );
    }

    // 转发到 Cloudinary
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("upload_preset", uploadPreset);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: uploadForm,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "上传失败" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      url: data.secure_url,
      publicId: data.public_id,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
