import * as React from 'react'
import { cn } from '../../lib/utils'

const Card = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-lg border transition-colors',
      'border-neutral-200 dark:border-[#1f1f1f]',
      'bg-white dark:bg-[#141414]',
      'text-neutral-800 dark:text-[#ddd]',
      'hover:border-neutral-300 dark:hover:border-[#2a2a2a]',
      'hover:bg-neutral-50 dark:hover:bg-[#181818]',
      className,
    )}
    {...props}
  />
))
Card.displayName = 'Card'

const CardHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-1 p-4', className)} {...props} />
)
const CardTitle = ({ className, ...props }) => (
  <div className={cn('text-[14px] font-medium text-neutral-900 dark:text-white leading-tight', className)} {...props} />
)
const CardDescription = ({ className, ...props }) => (
  <div className={cn('text-[11px] text-neutral-500 dark:text-[#555]', className)} {...props} />
)
const CardContent = ({ className, ...props }) => (
  <div className={cn('px-4 pb-4', className)} {...props} />
)

export { Card, CardHeader, CardTitle, CardDescription, CardContent }
