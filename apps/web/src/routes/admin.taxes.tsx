import { createFileRoute } from '@tanstack/react-router'
import { TaxesPage } from '../features/financial-configuration'

export const Route = createFileRoute('/admin/taxes')({ component: TaxesPage })
