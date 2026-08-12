import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export const fetchRecipeStatus = () =>
  api.get('/recipes/status').then(unwrap)

export const getItemRecipe = (menuItemId: string) =>
  api.get(`/recipes/items/${menuItemId}`).then(unwrap)

export const getRecipeVersions = (menuItemId: string) =>
  api.get(`/recipes/items/${menuItemId}/versions`).then(unwrap)

export const getItemCosting = (menuItemId: string) =>
  api.get(`/recipes/items/${menuItemId}/costing`).then(unwrap)

export const createRecipe = (data: any) =>
  api.post('/recipes', data).then(unwrap)

export const updateRecipe = (menuItemId: string, data: any) =>
  api.put(`/recipes/items/${menuItemId}`, data).then(unwrap)

export const getRecipeById = (id: string) =>
  api.get(`/recipes/${id}`).then(unwrap)
