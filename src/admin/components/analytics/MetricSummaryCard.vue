<!-- src/admin/components/analytics/MetricSummaryCard.vue -->
<template>
  <div class="metric-summary-card" :class="[metric.trendDesirability, isDrillable ? 'interactive' : '']" @click="handleDrillDown">
      
      <div class="metric-header">
          <h4>{{ metric.label }}</h4>
          <div class="trend-badge" v-if="metric.trendDelta !== undefined">
             <span class="icon">{{ trendIcon }}</span>
             <span class="delta">{{ formatTrend(metric.trendDelta) }}</span>
          </div>
      </div>

      <div class="metric-body">
          <div class="value">{{ formattedValue }}</div>
          <p class="subtitle" v-if="subtitle">{{ subtitle }}</p>
      </div>

      <div class="metric-footer" v-if="isDrillable">
          <span class="drill-hint">View Details &rarr;</span>
      </div>

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { MetricDefinition } from '../../architecture/AnalyticsOperationsRoutes';

const router = useRouter();

const props = defineProps<{
    metric: MetricDefinition;
    subtitle?: string;
}>();

const isDrillable = computed(() => !!props.metric.drillDownRoute);

// INTEGRATION 7: Drill-down actions pushing active Query params securely into target Vue consoles.
const handleDrillDown = () => {
    if (!isDrillable.value || !props.metric.drillDownRoute) return;
    
    // Explicitly pushes the defined Route mapping parameters to pre-filter the destination physical UI.
    router.push({
        path: props.metric.drillDownRoute.path,
        query: props.metric.drillDownRoute.query
    });
};

const formattedValue = computed(() => {
    const v = props.metric.value;
    if (props.metric.format === 'percentage') return `${v}%`;
    if (props.metric.format === 'duration' && typeof v === 'number') {
        const h = Math.floor(v / 3600000);
        const m = Math.floor((v % 3600000) / 60000);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${Math.floor((v % 60000) / 1000)}s`;
    }
    // raw 'number'
    return v.toString();
});

const formatTrend = (delta: number) => {
    if (props.metric.format === 'percentage') return `${Math.abs(delta)}%`;
    return Math.abs(delta).toString();
};

const trendIcon = computed(() => {
    if (props.metric.trendDirection === 'up') return '▲';
    if (props.metric.trendDirection === 'down') return '▼';
    return '-';
});
</script>

<style scoped>
.metric-summary-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 8px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    transition: transform 0.2s, border-color 0.2s;
    height: 100%;
}

.metric-summary-card.interactive {
    cursor: pointer;
}
.metric-summary-card.interactive:hover {
    transform: translateY(-2px);
    border-color: #3b82f6;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
}

.metric-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
}
.metric-header h4 {
    margin: 0;
    font-size: 13px;
    color: #94a3b8;
    text-transform: uppercase;
    font-weight: 600;
}

.trend-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: bold;
    padding: 2px 6px;
    border-radius: 4px;
}
.metric-summary-card.good .trend-badge   { color: #10b981; background: rgba(16, 185, 129, 0.1); }
.metric-summary-card.bad .trend-badge    { color: #ef4444; background: rgba(239, 68, 68, 0.1); }
.metric-summary-card.neutral .trend-badge { color: #64748b; background: rgba(100, 116, 139, 0.1); }

.metric-body .value {
    font-size: 36px;
    font-weight: bold;
    font-family: monospace;
    color: #f8fafc;
    line-height: 1;
}

.metric-body .subtitle {
    margin: 8px 0 0 0;
    font-size: 12px;
    color: #64748b;
}

.metric-footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #334155;
    text-align: right;
}
.drill-hint {
    font-size: 11px;
    color: #3b82f6;
    font-weight: bold;
}
</style>
