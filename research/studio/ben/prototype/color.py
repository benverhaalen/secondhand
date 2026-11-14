"""Deterministic color correction for capture shots.

Two operations, both done in linear sRGB so gains are physically meaningful:
1. white_reference_gain: a neutral patch (white card, paper, or a white tag) gives
   per-channel gains that make the patch neutral (von Kries / diagonal model).
2. match_to_anchor: shots taken without the card get gains that match the item's
   own pixels to the anchor shot (the item is the reference once the anchor is fixed).
"""
import numpy as np


def srgb_to_linear(u8):
    x = u8.astype(np.float64) / 255.0
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(lin):
    lin = np.clip(lin, 0, 1)
    x = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * lin ** (1 / 2.4) - 0.055)
    return np.round(x * 255).astype(np.uint8)


def robust_mean(lin, mask):
    """Mean of masked pixels, excluding clipped and darkest 5% (specular, shadow)."""
    px = lin[mask.astype(bool)]
    lum = px @ np.array([0.2126, 0.7152, 0.0722])
    keep = (px.max(axis=1) < 0.98) & (lum >= np.percentile(lum, 5))
    if keep.sum() < 50:
        raise ValueError("reference patch too small or clipped; ask for a retake")
    return px[keep].mean(axis=0)


def white_reference_gain(img_u8, patch_mask, target_lum=0.80):
    """Gains that map the patch to neutral grey at target_lum (exposure + white balance)."""
    m = robust_mean(srgb_to_linear(img_u8), patch_mask)
    return target_lum / m


def match_to_anchor(img_u8, item_mask, anchor_u8, anchor_mask):
    """Gains that make this shot's item median color equal the corrected anchor's.

    Uses medians of the item pixels in each shot. Valid when both shots show
    mostly the same material (front vs back of one garment); the plan flags
    shots where the dominant colors differ (e.g. a sole close-up) for the card.
    """
    a = np.median(srgb_to_linear(anchor_u8)[anchor_mask.astype(bool)], axis=0)
    b = np.median(srgb_to_linear(img_u8)[item_mask.astype(bool)], axis=0)
    return a / np.maximum(b, 1e-4)


def apply_gain(img_u8, gain):
    return linear_to_srgb(srgb_to_linear(img_u8) * gain)
