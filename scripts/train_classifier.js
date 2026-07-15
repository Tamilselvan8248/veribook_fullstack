/**
 * VeriBook — AI Classifier Training Script
 * ==========================================
 * Generates synthetic labeled canvas images for book conditions and trains
 * a TF.js CNN to recognise them. Exports the model to:
 *   client/public/tfmodel/model.json  (+ weight shards)
 *
 * Usage:
 *   node scripts/train_classifier.js
 *
 * Uses @tensorflow/tfjs (pure JavaScript CPU backend) — no native build tools required.
 * Runtime: ~3-6 minutes on CPU.
 */

// Pure-JS TF.js — works on any platform without Visual Studio or native build tools
const tf = require('@tensorflow/tfjs');

const path = require('path');
const fs   = require('fs');

// ── Config ────────────────────────────────────────────────────────────────────
const IMG_SIZE     = 64;    // Smaller than 224 for fast training
const NUM_CLASSES  = 3;     // 0=Mint, 1=Good, 2=Damaged
const SAMPLES_PER  = 400;   // Synthetic samples per class
const EPOCHS       = 25;
const BATCH_SIZE   = 32;
const OUTPUT_DIR   = path.join(__dirname, '../client/public/tfmodel');

// ── Synthetic Image Generators ────────────────────────────────────────────────
/**
 * Generate a pixel buffer (Uint8Array, RGB) for a given condition class.
 * Mint  → clean, mostly uniform light background
 * Good  → some dark ink pixels and mild highlights
 * Damaged → heavy dark regions, brownish stains, high-contrast edge noise
 */
function generateSample(classIdx) {
  const pixels = new Uint8Array(IMG_SIZE * IMG_SIZE * 3);

  // Base: simulate a page (light beige/white background)
  const baseR = 230 + Math.floor(Math.random() * 20);
  const baseG = 225 + Math.floor(Math.random() * 20);
  const baseB = 210 + Math.floor(Math.random() * 20);

  for (let i = 0; i < IMG_SIZE * IMG_SIZE; i++) {
    pixels[i * 3]     = baseR + Math.floor(Math.random() * 10 - 5);
    pixels[i * 3 + 1] = baseG + Math.floor(Math.random() * 10 - 5);
    pixels[i * 3 + 2] = baseB + Math.floor(Math.random() * 10 - 5);
  }

  if (classIdx === 0) {
    // MINT: minimal noise, no stains, maybe a few faint printed text pixels
    const textLines = Math.floor(Math.random() * 6 + 2);
    for (let l = 0; l < textLines; l++) {
      const y = Math.floor(Math.random() * IMG_SIZE);
      const lineLen = Math.floor(Math.random() * IMG_SIZE * 0.6 + IMG_SIZE * 0.2);
      const startX = Math.floor(Math.random() * (IMG_SIZE - lineLen));
      for (let x = startX; x < startX + lineLen; x++) {
        const idx = (y * IMG_SIZE + x) * 3;
        pixels[idx]     = 40 + Math.floor(Math.random() * 40); // dark grey/black text
        pixels[idx + 1] = 40 + Math.floor(Math.random() * 40);
        pixels[idx + 2] = 40 + Math.floor(Math.random() * 40);
      }
    }
  } else if (classIdx === 1) {
    // GOOD: ink markings, mild highlighter streaks, some page yellowing
    const inkStrokes = Math.floor(Math.random() * 20 + 8);
    for (let s = 0; s < inkStrokes; s++) {
      const y = Math.floor(Math.random() * IMG_SIZE);
      const len = Math.floor(Math.random() * 20 + 5);
      const startX = Math.floor(Math.random() * (IMG_SIZE - len));
      for (let x = startX; x < startX + len; x++) {
        const idx = (y * IMG_SIZE + x) * 3;
        // Dark blue/black pen marks
        pixels[idx]     = 20 + Math.floor(Math.random() * 60);
        pixels[idx + 1] = 20 + Math.floor(Math.random() * 60);
        pixels[idx + 2] = 60 + Math.floor(Math.random() * 60);
      }
    }
    // Neon highlighter patches
    const highlights = Math.floor(Math.random() * 4 + 1);
    for (let h = 0; h < highlights; h++) {
      const y = Math.floor(Math.random() * IMG_SIZE);
      const len = Math.floor(Math.random() * 18 + 8);
      const startX = Math.floor(Math.random() * (IMG_SIZE - len));
      for (let x = startX; x < startX + len; x++) {
        const idx = (y * IMG_SIZE + x) * 3;
        pixels[idx]     = 220 + Math.floor(Math.random() * 30); // yellow/neon
        pixels[idx + 1] = 220 + Math.floor(Math.random() * 30);
        pixels[idx + 2] = 50  + Math.floor(Math.random() * 40);
      }
    }
  } else {
    // DAMAGED: heavy stains, torn edges, very dark regions, creases
    // Water stain blobs (brownish)
    const stains = Math.floor(Math.random() * 5 + 3);
    for (let s = 0; s < stains; s++) {
      const cx = Math.floor(Math.random() * IMG_SIZE);
      const cy = Math.floor(Math.random() * IMG_SIZE);
      const r  = Math.floor(Math.random() * 10 + 4);
      for (let y = Math.max(0, cy - r); y < Math.min(IMG_SIZE, cy + r); y++) {
        for (let x = Math.max(0, cx - r); x < Math.min(IMG_SIZE, cx + r); x++) {
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) {
            const idx = (y * IMG_SIZE + x) * 3;
            pixels[idx]     = 160 + Math.floor(Math.random() * 40); // brownish
            pixels[idx + 1] = 120 + Math.floor(Math.random() * 30);
            pixels[idx + 2] = 70  + Math.floor(Math.random() * 30);
          }
        }
      }
    }
    // Dark crease lines
    const creases = Math.floor(Math.random() * 4 + 2);
    for (let c = 0; c < creases; c++) {
      const isHoriz = Math.random() > 0.5;
      const pos = Math.floor(Math.random() * IMG_SIZE);
      for (let i = 0; i < IMG_SIZE; i++) {
        const px = isHoriz ? i : pos;
        const py = isHoriz ? pos : i;
        const idx = (py * IMG_SIZE + px) * 3;
        pixels[idx]     = 60 + Math.floor(Math.random() * 40);
        pixels[idx + 1] = 55 + Math.floor(Math.random() * 40);
        pixels[idx + 2] = 55 + Math.floor(Math.random() * 40);
      }
    }
    // Heavy dark ink / pen bleed regions
    const bleed = Math.floor(Math.random() * 10 + 5);
    for (let b = 0; b < bleed; b++) {
      const y = Math.floor(Math.random() * IMG_SIZE);
      const len = Math.floor(Math.random() * 30 + 10);
      const startX = Math.floor(Math.random() * Math.max(1, IMG_SIZE - len));
      for (let x = startX; x < Math.min(IMG_SIZE, startX + len); x++) {
        const idx = (y * IMG_SIZE + x) * 3;
        pixels[idx]     = 15 + Math.floor(Math.random() * 30);
        pixels[idx + 1] = 15 + Math.floor(Math.random() * 30);
        pixels[idx + 2] = 15 + Math.floor(Math.random() * 30);
      }
    }
  }

  return pixels;
}

// ── Build Dataset ─────────────────────────────────────────────────────────────
function buildDataset() {
  const totalSamples = NUM_CLASSES * SAMPLES_PER;
  const xData = new Float32Array(totalSamples * IMG_SIZE * IMG_SIZE * 3);
  const yData = new Float32Array(totalSamples * NUM_CLASSES);

  let sampleIdx = 0;
  for (let cls = 0; cls < NUM_CLASSES; cls++) {
    for (let s = 0; s < SAMPLES_PER; s++) {
      const pixels = generateSample(cls);
      // Normalise to [0, 1]
      const offset = sampleIdx * IMG_SIZE * IMG_SIZE * 3;
      for (let p = 0; p < pixels.length; p++) {
        xData[offset + p] = pixels[p] / 255.0;
      }
      // One-hot label
      yData[sampleIdx * NUM_CLASSES + cls] = 1.0;
      sampleIdx++;
    }
  }

  // Shuffle in place
  const indices = Array.from({ length: totalSamples }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const xShuffled = new Float32Array(xData.length);
  const yShuffled = new Float32Array(yData.length);
  indices.forEach((origIdx, newIdx) => {
    xShuffled.set(xData.slice(origIdx * IMG_SIZE * IMG_SIZE * 3, (origIdx + 1) * IMG_SIZE * IMG_SIZE * 3), newIdx * IMG_SIZE * IMG_SIZE * 3);
    yShuffled.set(yData.slice(origIdx * NUM_CLASSES, (origIdx + 1) * NUM_CLASSES), newIdx * NUM_CLASSES);
  });

  const xs = tf.tensor4d(xShuffled, [totalSamples, IMG_SIZE, IMG_SIZE, 3]);
  const ys = tf.tensor2d(yShuffled, [totalSamples, NUM_CLASSES]);
  return { xs, ys };
}

// ── Model Architecture ────────────────────────────────────────────────────────
function buildModel() {
  const model = tf.sequential();

  model.add(tf.layers.conv2d({ inputShape: [IMG_SIZE, IMG_SIZE, 3], kernelSize: 3, filters: 32, activation: 'relu', padding: 'same' }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
  model.add(tf.layers.dropout({ rate: 0.25 }));

  model.add(tf.layers.conv2d({ kernelSize: 3, filters: 64, activation: 'relu', padding: 'same' }));
  model.add(tf.layers.batchNormalization());
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
  model.add(tf.layers.dropout({ rate: 0.25 }));

  model.add(tf.layers.conv2d({ kernelSize: 3, filters: 128, activation: 'relu', padding: 'same' }));
  model.add(tf.layers.maxPooling2d({ poolSize: [2, 2] }));
  model.add(tf.layers.dropout({ rate: 0.3 }));

  model.add(tf.layers.flatten());
  model.add(tf.layers.dense({ units: 128, activation: 'relu' }));
  model.add(tf.layers.dropout({ rate: 0.4 }));
  model.add(tf.layers.dense({ units: NUM_CLASSES, activation: 'softmax' }));

  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy'],
  });

  return model;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🤖 VeriBook AI Classifier — Training Script');
  console.log('────────────────────────────────────────────');

  // Initialise TF.js CPU backend explicitly
  await tf.setBackend('cpu');
  await tf.ready();
  console.log(`⚙️  Backend: ${tf.getBackend()}`);
  console.log(`📦 Generating ${NUM_CLASSES * SAMPLES_PER} synthetic samples (${SAMPLES_PER} per class)…`);

  const { xs, ys } = buildDataset();
  console.log(`✅ Dataset ready — shape: ${xs.shape}`);

  const model = buildModel();
  model.summary();

  // Split 80/20 train/val
  const splitIdx = Math.floor(xs.shape[0] * 0.8);
  const xTrain   = xs.slice([0, 0, 0, 0], [splitIdx, IMG_SIZE, IMG_SIZE, 3]);
  const yTrain   = ys.slice([0, 0], [splitIdx, NUM_CLASSES]);
  const xVal     = xs.slice([splitIdx, 0, 0, 0], [-1, IMG_SIZE, IMG_SIZE, 3]);
  const yVal     = ys.slice([splitIdx, 0], [-1, NUM_CLASSES]);

  console.log(`\n🔁 Training for ${EPOCHS} epochs…\n`);
  await model.fit(xTrain, yTrain, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    validationData: [xVal, yVal],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        const acc    = (logs.acc    ?? logs.accuracy ?? 0) * 100;
        const valAcc = (logs.val_acc ?? logs.val_accuracy ?? 0) * 100;
        process.stdout.write(
          `  Epoch ${String(epoch + 1).padStart(2, '0')}/${EPOCHS}  ` +
          `loss: ${logs.loss.toFixed(4)}  acc: ${acc.toFixed(1)}%  ` +
          `val_acc: ${valAcc.toFixed(1)}%\n`
        );
      },
    },
  });

  // Save model
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const saveUrl = `file://${OUTPUT_DIR}`;
  await model.save(saveUrl);

  // Clean up tensors
  xs.dispose(); ys.dispose();
  xTrain.dispose(); yTrain.dispose();
  xVal.dispose(); yVal.dispose();

  console.log(`\n✅ Model saved to: ${OUTPUT_DIR}`);
  console.log('   Files: model.json + weights.bin shard(s)');
  console.log('\n🎉 Done! The browser will now load real trained weights from /tfmodel/model.json');
}

main().catch(err => { console.error('Training failed:', err); process.exit(1); });
