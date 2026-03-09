/**
 * src/engine/layout/SectionLayoutComposer.ts
 * 
 * LAYER A — Section Layout Composer
 * Codex §Rule 7: Layout remains compositional.
 * 
 * The Section Layout Composer is section-schema-driven, reorderable,
 * metadata-rich, animation-aware, overlap-aware, and sticky-aware.
 * 
 * It does NOT contain page-specific markup. It constructs a section-ready
 * structure from normalized content, resolved template config, and layout schemas.
 */

// ==========================================
// SECTION SCHEMA TYPES
// ==========================================

export type SectionType =
    | 'hero-centerpiece'
    | 'content-block'
    | 'gallery-grid'
    | 'testimonial-carousel'
    | 'cta-banner'
    | 'feature-showcase'
    | 'media-interlude'
    | 'footer';

export interface SectionSchema {
    /** Unique ID for this section instance */
    id: string;
    /** Section type determines the layout strategy */
    type: SectionType;
    /** Display order — composer uses this for reordering */
    order: number;
    /** Whether this section is enabled for the current breakpoint */
    enabled: boolean;

    // --- Animation Awareness ---
    /** Named animation preset to apply on enter (consumed by TypographyMotion) */
    enterPreset?: string;
    /** Named animation preset to apply on exit */
    exitPreset?: string;

    // --- Overlap Awareness ---
    /** Allow this section to overlap the section above (negative margin effect) */
    overlapPrevious: boolean;
    /** Percentage of viewport height this section overlaps into the previous */
    overlapAmount: number;

    // --- Sticky Awareness ---
    /** Pin this section during scroll for a specified duration */
    sticky: boolean;
    /** How long (in scroll progress units 0-1) the section remains pinned */
    stickyDuration: number;

    // --- Metadata ---
    /** Custom metadata for downstream systems (media, transitions, WebGL) */
    metadata: Record<string, unknown>;
}

export interface ComposedLayout {
    /** The final ordered, filtered, enriched section list */
    sections: ComposedSection[];
    /** Total computed height estimate (used by scroll controller) */
    estimatedTotalHeight: number;
    /** Active section count for analytics */
    activeSectionCount: number;
}

export interface ComposedSection extends SectionSchema {
    /** Computed cumulative offset from top (pixels) */
    computedOffset: number;
    /** Computed section height */
    computedHeight: number;
    /** Whether WebGL should be active during this section */
    webglActive: boolean;
    /** The scene mode WebGL should use during this section */
    webglSceneMode: 'logo-centerpiece' | 'layered-planes' | 'ambient' | 'none';
}

// ==========================================
// SECTION LAYOUT COMPOSER
// ==========================================

export class SectionLayoutComposer {
    private defaultSectionHeight = 100; // vh units, overridable per section

    /**
     * Composes a final layout from raw section schemas and template config.
     * 
     * This is the single entry point for building the visual page structure.
     * The output is consumed by:
     *   - ScrollController (to calculate section scroll boundaries)
     *   - ScrollTimelineController (to track per-section progress)
     *   - WebGLSceneManager (to know when to activate/deactivate scenes)
     *   - HeroCenterpiece.vue and other components (to know their order/overlap)
     */
    public compose(
        sectionSchemas: SectionSchema[],
        breakpoint: 'desktop' | 'tablet' | 'mobile',
        viewportHeight: number
    ): ComposedLayout {

        // 1. Filter disabled sections for this breakpoint
        const enabledSections = sectionSchemas.filter(s => s.enabled);

        // 2. Sort by explicit order (reorderable)
        const sorted = [...enabledSections].sort((a, b) => a.order - b.order);

        // 3. Compute cumulative offsets with overlap awareness
        let cumulativeOffset = 0;
        const composed: ComposedSection[] = sorted.map((section, index) => {
            const sectionHeight = this.resolveSectionHeight(section, breakpoint, viewportHeight);

            // Apply overlap from current section reaching into previous
            if (section.overlapPrevious && index > 0) {
                cumulativeOffset -= section.overlapAmount * viewportHeight;
            }

            const computedSection: ComposedSection = {
                ...section,
                computedOffset: cumulativeOffset,
                computedHeight: sectionHeight,
                webglActive: this.resolveWebGLActive(section, breakpoint),
                webglSceneMode: this.resolveWebGLSceneMode(section)
            };

            cumulativeOffset += sectionHeight;
            return computedSection;
        });

        return {
            sections: composed,
            estimatedTotalHeight: cumulativeOffset,
            activeSectionCount: composed.length
        };
    }

    /**
     * Resolves section height based on type, breakpoint, and metadata.
     */
    private resolveSectionHeight(
        section: SectionSchema,
        breakpoint: 'desktop' | 'tablet' | 'mobile',
        viewportHeight: number
    ): number {
        // Sticky sections extend their height by their sticky duration
        const baseHeight = viewportHeight * (this.defaultSectionHeight / 100);
        const stickyExtension = section.sticky ? baseHeight * section.stickyDuration : 0;

        // Mobile sections are typically shorter
        const breakpointScalar = breakpoint === 'mobile' ? 0.8 : breakpoint === 'tablet' ? 0.9 : 1.0;

        return (baseHeight + stickyExtension) * breakpointScalar;
    }

    /**
     * Determines if WebGL should be active during this section.
     * Performance doctrine: disable WebGL for non-visual sections on lower tiers.
     */
    private resolveWebGLActive(section: SectionSchema, breakpoint: 'desktop' | 'tablet' | 'mobile'): boolean {
        if (breakpoint === 'mobile') {
            // On mobile, only hero sections get WebGL
            return section.type === 'hero-centerpiece';
        }
        return ['hero-centerpiece', 'feature-showcase', 'media-interlude'].includes(section.type);
    }

    /**
     * Maps section type to the appropriate WebGL scene mode.
     */
    private resolveWebGLSceneMode(section: SectionSchema): 'logo-centerpiece' | 'layered-planes' | 'ambient' | 'none' {
        switch (section.type) {
            case 'hero-centerpiece': return 'logo-centerpiece';
            case 'media-interlude': return 'layered-planes';
            case 'feature-showcase': return 'ambient';
            default: return 'none';
        }
    }
}
