import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-300 dark:focus-visible:ring-[#444] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200',
        destructive:
          'bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500',
        outline:
          'border border-neutral-300 dark:border-[#2a2a2a] bg-transparent text-neutral-700 dark:text-[#ccc] hover:text-neutral-900 dark:hover:text-white hover:border-neutral-400 dark:hover:border-[#444] hover:bg-neutral-100 dark:hover:bg-[#141414]',
        ghost:
          'text-neutral-500 dark:text-[#888] hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-[#161616]',
        secondary:
          'bg-neutral-100 dark:bg-[#1a1a1a] text-neutral-800 dark:text-[#ddd] border border-neutral-200 dark:border-[#2a2a2a] hover:bg-neutral-200 dark:hover:bg-[#222]',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-7 px-3 text-[11px]',
        lg: 'h-10 px-6',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
Button.displayName = 'Button'

export { Button, buttonVariants }
