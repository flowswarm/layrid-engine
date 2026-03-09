<!-- src/admin/components/domain/AssetVariantCard.vue -->
<template>
  <div 
    class="variant-card" 
    :class="{ 'is-primary': isPrimary, 'is-archived': isArchived }"
    @click="$emit('select', variant.assetId)"
  >
      
      <!-- Visual Thumbnail Block -->
      <div class="visual-block">
          <img v-if="variant.thumbnailUrl" :src="variant.thumbnailUrl" alt="Asset Preview" />
          <div v-else class="placeholder">
             <!-- Show visual icon for standard types -->
             <span v-if="variant.materialPreset === 'chrome'">🪞</span>
             <span v-else-if="variant.materialPreset === 'matte'">🌑</span>
             <span v-else>🧊</span>
          </div>

          <!-- Absolute positioned status pill -->
          <div class="status-pill" :class="variant.status">
              {{ variant.status.toUpperCase() }}
          </div>
      </div>

      <!-- Metadata Block -->
      <div class="meta-block">
          <div class="hash-id">{{ formatHash(variant.assetId) }}</div>
          
          <div class="tags">
             <span class="preset-tag">{{ variant.materialPreset }}</span>
             <span class="source-tag">{{ variant.sourceType === 'imported-logo' ? 'SVG' : 'TXT' }}</span>
          </div>

          <!-- Operations Markers -->
          <div class="ops-markers" v-if="variant.queueItemId">
             <span class="warning-icon" title="Linked to Revision Queue Ticket">⚠️ Has Open Ticket</span>
          </div>
      </div>

  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';

const props = defineProps<{
    variant: any;
    isPrimary?: boolean;
    isArchived?: boolean;
}>();

defineEmits(['select']);

const formatHash = (id: string) => {
    if (!id) return 'UNKNOWN';
    if (id.length <= 12) return id;
    return `${id.slice(0, 5)}...${id.slice(-5)}`;
};
</script>

<style scoped>
.variant-card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; overflow: hidden; cursor: pointer; transition: transform 0.2s, border-color 0.2s; }
.variant-card:hover { transform: translateY(-2px); border-color: #3b82f6; }
.variant-card.is-primary { border: 2px solid #10b981; }
.variant-card.is-archived { opacity: 0.6; filter: grayscale(50%); }

.visual-block { position: relative; height: 140px; background: #0f172a; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #334155; }
.visual-block img { width: 100%; height: 100%; object-fit: cover; }
.placeholder { font-size: 40px; opacity: 0.5; }

.status-pill { position: absolute; top: 8px; right: 8px; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; background: #64748b; color: white; }
.status-pill.published { background: #10b981; }
.status-pill.reviewing { background: #3b82f6; }
.status-pill.rejected, .status-pill.archived { background: #ef4444; }

.meta-block { padding: 12px; }
.hash-id { font-family: monospace; font-size: 13px; color: #e2e8f0; margin-bottom: 8px; font-weight: bold; }

.tags { display: flex; gap: 6px; margin-bottom: 8px; }
.preset-tag { background: #334155; color: #cbd5e1; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
.source-tag { background: #0f172a; color: #94a3b8; font-size: 10px; padding: 2px 6px; border-radius: 4px; border: 1px solid #334155; }

.ops-markers { margin-top: 8px; padding-top: 8px; border-top: 1px solid #334155; font-size: 11px; color: #f59e0b; }
</style>
