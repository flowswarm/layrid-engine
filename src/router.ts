import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
    {
        path: '/',
        name: 'home',
        component: () => import('./pages/HomePage.vue'),
    },
    {
        path: '/engine-proof',
        name: 'engine-proof',
        component: () => import('./pages/EngineProof.vue'),
    },
    {
        path: '/pipeline-proof',
        name: 'pipeline-proof',
        component: () => import('./pages/PipelineProof.vue'),
    },
    {
        path: '/studio',
        name: 'studio',
        component: () => import('./pages/LayridStudio.vue'),
    }
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});
