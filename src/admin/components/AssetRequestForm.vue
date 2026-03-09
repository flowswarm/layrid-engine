<script setup lang="ts">
import { ref, reactive } from 'vue';
import { AdminAssetRequest, AdminAssetRequestSchema } from '../schemas/adminRequest.schema';
import { normalizeAdminRequest } from '../normalizer';
import { ZodError } from 'zod';

const form = reactive<Partial<AdminAssetRequest>>({
  sourceType: 'svg_upload',
  targetExportName: '',
  brandName: '',
  materialPreset: 'chrome',
  extrusionDepth: 0.12,
  bevelAmount: 0.02,
  isHeroUsage: true,
  allowAnchorPublishing: true
});

const errors = ref<Record<string, string>>({});
const isSubmitting = ref(false);

const submitToPipeline = async () => {
  errors.value = {};
  isSubmitting.value = true;

  try {
    // 1. Validate Form Data
    const validData = AdminAssetRequestSchema.parse(form);
    
    // 2. Normalize for Backend Pipeline
    const pipelinePayload = normalizeAdminRequest(validData);
    
    // 3. Fake API Call to MCP Orchestrator
    console.log('[Admin] Submitting Pipeline Request:', pipelinePayload);
    // await fetch('/api/mcp/generate-logo', { method: 'POST', body: JSON.stringify(pipelinePayload) });
    
    /**
     * WIRING EXAMPLES:
     * Once the MCP Pipeline responds with success and the `/models/target.glb` path, 
     * we save the following strict data into the CMS for this brand:
     * 
     * {
     *   webgl: {
     *      sceneMode: validData.preferredSceneMode,
     *      centerpieceSource: `/models/${validData.targetExportName}.glb`
     *   }
     * }
     * 
     * This CMS data is what the Content Normalizer (useContentNormalizer.ts) 
     * will eventually read on the frontend.
     */
     
     alert('Asset Generation Queued!');
     
  } catch (err) {
    if (err instanceof ZodError) {
      err.errors.forEach(e => {
        if (e.path[0]) {
            errors.value[e.path[0].toString()] = e.message;
        }
      });
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<template>
  <form @submit.prevent="submitToPipeline" class="p-6 bg-slate-900 text-white rounded-lg max-w-2xl">
    <h2 class="text-2xl font-bold mb-6">Request 3D WebGL Centerpiece</h2>
    
    <div class="space-y-4">
      <!-- Core Identification -->
      <div>
        <label>Brand Name</label>
        <input v-model="form.brandName" type="text" class="w-full bg-slate-800 p-2 rounded" />
        <span v-if="errors.brandName" class="text-red-500 text-sm">{{ errors.brandName }}</span>
      </div>

      <div>
        <label>Export Filename (e.g. 'nexus-studio')</label>
        <input v-model="form.targetExportName" type="text" class="w-full bg-slate-800 p-2 rounded" />
        <span v-if="errors.targetExportName" class="text-red-500 text-sm">{{ errors.targetExportName }}</span>
      </div>

      <!-- Source Selection -->
      <div class="pt-4 border-t border-slate-700">
        <label>Source Type</label>
        <select v-model="form.sourceType" class="w-full bg-slate-800 p-2 rounded">
          <option value="svg_upload">SVG Vector Logo</option>
          <option value="text_generated">Text Only</option>
        </select>
      </div>

      <div v-if="form.sourceType === 'svg_upload'">
        <label>Uploaded Vector ID</label>
        <input v-model="form.sourceFileId" type="text" class="w-full bg-slate-800 p-2 rounded" placeholder="e.g. uuid-1234" />
        <span v-if="errors.sourceFileId" class="text-red-500 text-sm">{{ errors.sourceFileId }}</span>
      </div>

      <div v-if="form.sourceType === 'text_generated'">
        <label>Text Content</label>
        <input v-model="form.textContent" type="text" class="w-full bg-slate-800 p-2 rounded" placeholder="e.g. ACME" />
        <span v-if="errors.textContent" class="text-red-500 text-sm">{{ errors.textContent }}</span>
      </div>

      <!-- Aesthetic Choices -->
      <div class="pt-4 border-t border-slate-700 grid grid-cols-2 gap-4">
        <div>
           <label>Material Preset</label>
           <select v-model="form.materialPreset" class="w-full bg-slate-800 p-2 rounded">
             <option value="chrome">Polished Chrome</option>
             <option value="brushed-metal">Brushed Metal</option>
             <option value="matte-plastic">Matte Plastic</option>
             <option value="glass">Refractive Glass</option>
             <option value="emissive-neon">Emissive Neon</option>
           </select>
        </div>
        <div>
           <label>Primary Hex (Optional)</label>
           <input v-model="form.primaryColorHex" type="text" class="w-full bg-slate-800 p-2 rounded" placeholder="#FF3366" />
           <span v-if="errors.primaryColorHex" class="text-red-500 text-sm">{{ errors.primaryColorHex }}</span>
        </div>
      </div>
      
      <!-- Geometry Tuning -->
      <div class="grid grid-cols-2 gap-4">
        <div>
           <label>Depth (0.01 - 2.0)</label>
           <input v-model.number="form.extrusionDepth" type="number" step="0.01" class="w-full bg-slate-800 p-2 rounded" />
        </div>
        <div>
           <label>Bevel (0.0 - 0.5)</label>
           <input v-model.number="form.bevelAmount" type="number" step="0.01" class="w-full bg-slate-800 p-2 rounded" />
        </div>
      </div>
      
      <!-- Engine Hooks -->
      <div class="pt-4 border-t border-slate-700 flex gap-4">
         <label class="flex items-center gap-2">
            <input v-model="form.isHeroUsage" type="checkbox" />
            Enable as WebGL Hero
         </label>
         <label class="flex items-center gap-2">
            <input v-model="form.allowAnchorPublishing" type="checkbox" />
            Publish Motion Engine Anchors
         </label>
      </div>

      <button type="submit" :disabled="isSubmitting" class="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold rounded mt-6 transition-colors">
        {{ isSubmitting ? 'Validating & Queueing...' : 'Request 3D Centerpiece Generation' }}
      </button>
    </div>
  </form>
</template>
