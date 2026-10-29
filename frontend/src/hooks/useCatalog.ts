import { getCategories, getProducts, getSettings } from '../services/catalog'
import { useQuery } from './useQuery'

export const useSettings = () => useQuery('settings', getSettings)
export const useCategories = () => useQuery('categories', getCategories)
export const useProducts = () => useQuery('products', getProducts)
