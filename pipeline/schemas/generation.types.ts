import { z } from 'zod';

export const LogoGenerationRequestSchema = z.object({
  // Source
  inputType: z.enum(['svg', 'text', 'png']),
  sourcePayload: z.string(), // File path OR text string
  
  // Geometry
  extrusionDepth: z.number().min(0.01).max(2.0).default(0.1),
  bevelDepth: z.number().min(0).max(0.5).default(0.02),
  bevelResolution: z.number().min(0).max(10).default(4),
  
  // Aesthetics (Mapped to predefined Blender node groups)
  materialPreset: z.enum([
    'brushed-metal', 'chrome', 'matte-plastic', 'glass', 'emissive-neon', 'flat-monochrome'
  ]).default('chrome'),
  brandColorHex: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  
  // Output configuration
  targetFilename: z.string().default('hero-centerpiece'),
});

export type LogoGenerationRequest = z.infer<typeof LogoGenerationRequestSchema>;
