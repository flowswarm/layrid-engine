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
        component: () => import('./engine/components/EngineProof.vue'),
    }
];

export const router = createRouter({
    history: createWebHistory(),
    routes,
});
