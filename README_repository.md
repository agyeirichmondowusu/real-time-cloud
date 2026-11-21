# COME — Cloud Observation and Monitoring Equipment (research code)

Code accompanying the manuscript *“Real-Time Cloud Observation and Monitoring System with IoT and
Machine Learning”* (Adjetey, Owusu Agyei, Asilevi, Kornyo, Quansah — KNUST).

It reproduces the cloud-segmentation results reported in the paper: the session-disjoint smartphone
test (Table 4, Figure 6), the cross-instrument evaluation on AMB82-Mini frames (Section 3.4,
Figure 7), and the accuracy of the compressed on-device model.

## Two segmentation models — read this first

| | Research model (all reported metrics) | On-device model (AMB82-Mini) |
|---|---|---|
| Architecture | U-Net, base width 32, standard 3×3 convolutions | U-Net-style, depthwise-separable convolutions |
| Input | 4 channels (B, G, R, RBDI), 320 × 320 | 3 channels, 256 × 256 |
| Parameters | 7.77 M (float32, 29.6 MiB) | ≈ 1.5 M (int8 weights, 1.6 MB TFLite) |
| Code | `come/model.py`, `scripts/train_eval_smartphone.py` | evaluated with `scripts/eval_edge_tflite.py` |

The on-device model is a separate network, not a quantised copy of the research model, so its
accuracy is measured separately with the same metric code.

## Repository layout

```
come/geometry.py     square crop -> 480 px -> sky disk; RBDI; 4-channel model input
come/pairs.py        strict id -> file pairing, session-purity and train/test overlap checks
come/model.py        research U-Net
come/train.py        loss (BCE + Dice), training with early stopping, fine-tuning, evaluation
come/metrics.py      pooled metrics inside the sky disk, incl. clear-sky IoU
come/stats.py        paired bootstrap for the adaptation gain
come/oktas.py        cloud fraction and oktas (sky-disk denominator)
come/infer.py        single-frame segmentation, oktas and cloud type
scripts/train_eval_smartphone.py   Table 4, Figure 6 data
scripts/cross_instrument.py        Section 3.4 (zero-shot and exploratory adaptation)
scripts/eval_edge_tflite.py        accuracy of the deployed TFLite model
scripts/make_figures.py            Figures 6 and 7
scripts/draft_amb82_masks.py       RBDI + Otsu drafts and ambiguity-ranked review queue
scripts/review_masks.py            interactive expert review of drafts
scripts/infer_folder.py            batch inference over a folder
deploy/server.py                   HTTP server used by the web dashboard
tests/test_core.py                 tests for geometry, metrics, oktas, pairing and statistics
```

## Data

* Smartphone images and expert-validated masks: WASCAT v1.0 (DOI: 10.5281/zenodo.XXXXXXX), with the
  session-disjoint split `metadata/rf_splits_v2.csv` (columns `id`, `vid`, `fold_v2`).
* AMB82-Mini evaluation frames (150) and their expert-verified masks: DOI: 10.5281/zenodo.YYYYYYY.

## Reproducing the results

```bash
pip install -r requirements.txt
python scripts/train_eval_smartphone.py --wascat DATA/wascat_v1.0 \
    --splits DATA/wascat_v1.0/metadata/rf_splits_v2.csv --out results/
python scripts/cross_instrument.py --amb-dir DATA/amb82_come --amb-meta DATA/amb82_come/amb82_metadata.csv \
    --checkpoint results/unet_sessionpure.pt --out results/
python scripts/eval_edge_tflite.py --model models/unet_edge.tflite --manifest results/split_manifest.csv \
    --wascat DATA/wascat_v1.0 --fold test --out results/edge_smartphone_test.json
python scripts/eval_edge_tflite.py --model models/unet_edge.tflite --amb-dir DATA/amb82_come \
    --amb-meta DATA/amb82_come/amb82_metadata.csv --out results/edge_amb82.json
python scripts/make_figures.py --results results/
python -m pytest tests/
```

`results/split_manifest.csv` lists every image used, its fold and SHA-1 checksum. Training is seeded
(2026) and cuDNN is set to deterministic mode; small run-to-run differences can remain on GPU.

## Training settings (as in the manuscript)

Adam, learning rate 1e-4, batch size 8, BCE + (1 − soft Dice), early stopping on validation IoU
(patience 15, maximum 110 epochs), no data augmentation. Adaptation: all layers fine-tuned for
15 epochs, Adam 1e-5, batch size 4, final-epoch weights kept. Metrics are pooled over all pixels
inside the sky disk at threshold 0.5.

## Not yet included

To be added before the archive is minted: EfficientNet-B0 training and 5-fold cross-validation;
training and conversion of the on-device model; AMB82-Mini and ESP32 firmware; the React dashboard;
the script that assigned video sessions to folds; the script for the GMet okta comparison (Section 3.1).

## Licence

Code: MIT (see `LICENSE`). Data are released separately under CC-BY-4.0.
