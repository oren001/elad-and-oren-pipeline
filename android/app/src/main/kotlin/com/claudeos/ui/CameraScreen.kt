package com.claudeos.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.util.Base64
import android.util.Size
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executor
import java.util.concurrent.Executors

@Composable
fun CameraScreen(prompt: String?, onCapture: (String) -> Unit) {
    val ctx = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val executor: Executor = remember { Executors.newSingleThreadExecutor() }
    var imageCapture by remember { mutableStateOf<ImageCapture?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .aspectRatio(3f / 4f)
            .clip(RoundedCornerShape(20.dp))
            .background(Color.Black),
    ) {
        AndroidView(
            factory = { context ->
                val previewView = PreviewView(context)
                bindCamera(context, lifecycleOwner, previewView, executor) { ic, err ->
                    imageCapture = ic
                    error = err
                }
                previewView
            },
            modifier = Modifier.fillMaxWidth().aspectRatio(3f / 4f),
        )

        Surface(
            shape = CircleShape,
            color = Color.Black.copy(alpha = 0.4f),
            modifier = Modifier.align(Alignment.TopStart).padding(8.dp),
        ) {
            Text(
                prompt ?: "Tap shutter",
                color = Color.White,
                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            )
        }

        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 12.dp)
                .size(72.dp)
                .clip(CircleShape)
                .background(Color.White)
                .pointerInput(imageCapture) {
                    detectTapToCapture { takePhoto(ctx, imageCapture, executor, onCapture) }
                },
        )

        error?.let {
            Surface(color = Color(0xFF7F1D1D), modifier = Modifier.align(Alignment.Center)) {
                Text("camera: $it", color = Color.White, modifier = Modifier.padding(8.dp))
            }
        }
    }

    DisposableEffect(Unit) { onDispose { (executor as? java.util.concurrent.ExecutorService)?.shutdown() } }
}

private suspend fun androidx.compose.ui.input.pointer.PointerInputScope.detectTapToCapture(onTap: () -> Unit) {
    androidx.compose.foundation.gestures.detectTapGestures(onTap = { onTap() })
}

private fun bindCamera(
    context: Context,
    lifecycleOwner: LifecycleOwner,
    previewView: PreviewView,
    executor: Executor,
    onReady: (ImageCapture?, String?) -> Unit,
) {
    val providerFuture = ProcessCameraProvider.getInstance(context)
    providerFuture.addListener({
        try {
            val provider = providerFuture.get()
            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
            val capture = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                .build()
            val selector = CameraSelector.DEFAULT_BACK_CAMERA
            provider.unbindAll()
            provider.bindToLifecycle(lifecycleOwner, selector, preview, capture)
            onReady(capture, null)
        } catch (e: Exception) {
            onReady(null, e.message)
        }
    }, ContextCompat.getMainExecutor(context))
}

private fun takePhoto(
    context: Context,
    imageCapture: ImageCapture?,
    executor: Executor,
    onResult: (String) -> Unit,
) {
    val ic = imageCapture ?: return
    ic.takePicture(executor, object : ImageCapture.OnImageCapturedCallback() {
        override fun onCaptureSuccess(image: ImageProxy) {
            try {
                val b64 = image.toJpegBase64()
                onResult(b64)
            } finally {
                image.close()
            }
        }
        override fun onError(exception: ImageCaptureException) { /* swallow */ }
    })
}

private fun ImageProxy.toJpegBase64(): String {
    val buffer = planes[0].buffer
    val bytes = ByteArray(buffer.remaining())
    buffer.get(bytes)
    val rotation = imageInfo.rotationDegrees
    val bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
    val rotated = if (rotation != 0) {
        val matrix = Matrix().apply { postRotate(rotation.toFloat()) }
        Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, matrix, true)
    } else bmp
    val baos = ByteArrayOutputStream()
    rotated.compress(Bitmap.CompressFormat.JPEG, 80, baos)
    return Base64.encodeToString(baos.toByteArray(), Base64.NO_WRAP)
}
