/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// A tiny 1x1 pixel PNG is lightweight, bulletproof and acts as the mock wrapper for the simulation.
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export const SAMPLE_TICKET_1 = {
  name: "Tique Barra Cafe",
  preview_url: "https://images.unsplash.com/photo-1543269865-cbf427effbad?w=600&auto=format&fit=crop&q=60",
  base64: TINY_PNG_BASE64,
  mime: "image/png"
};

export const SAMPLE_TICKET_2 = {
  name: "Tique Cena Terraza",
  preview_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&auto=format&fit=crop&q=60",
  base64: TINY_PNG_BASE64,
  mime: "image/png"
};
