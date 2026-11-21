# Changes from the exploratory notebooks

This repository consolidates `AMB_Frames_.ipynb`, the deployment server and the inference scripts.
The method (preprocessing, model, loss, optimiser, early stopping, adaptation) is unchanged; the
following changes were made for correctness and reproducibility. Results produced with this code
are the ones reported in the revised manuscript.

## Evaluation pipeline
1. **Safe file pairing.** The split file writes some ids without zero padding ("2") and the metadata
   with it ("0002"). Numeric ids are matched after removing leading zeros only when the match is
   unique; ambiguous matches stop with an error, and a test or validation id that cannot be loaded
   stops the run instead of silently shrinking the fold. The notebook's two different lookups gave
   different test scores for one checkpoint. Test and validation images are also checked against
   other folds by SHA-1.
2. **Validation IoU is pooled over the validation fold** (previously the mean of per-batch IoUs).
3. **Determinism:** cuDNN deterministic mode and a seeded DataLoader shuffle.
4. **Adaptation gain CI:** paired bootstrap of the pooled-IoU gain over the same held-out frames
   (previously an unpaired bootstrap of mean per-image IoU).
5. **Adaptation split** is drawn from frames sorted by id and saved to `adaptation_split.csv`.
6. **Clear-sky metrics** (IoU, recall, precision, mean IoU) are reported with the cloud-class metrics.

## Deployment and inference bugs fixed
* Cloud cover was computed as cloud pixels / cloud pixels, so every frame returned 8 oktas.
* The server and folder scripts segmented a random or the first saved file instead of the
  current frame.
* Random flips/rotations were applied at inference time to both models.
* Cloud cover in the inference notebook divided by the whole square image, capping results near
  6.3 oktas; the denominator is now the sky disk.
* The segmentation threshold at inference was 0.9; it is now 0.5, as in the evaluation.
