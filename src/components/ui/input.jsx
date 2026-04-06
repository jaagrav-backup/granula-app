import * as React from 'react'
import { cn } from '../../lib/utils'

const Input = React.forwardRef(({ className, type = 'text', ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded-md border px-3 py-2 text-[12px] outline-none disabled:opacity-50',
      'border-neutral-300 dark:border-[#2a2a2a] bg-white dark:bg-[#141414] text-neutral-900 dark:text-[#ddd]',
      'placeholder:text-neutral-400 dark:placeholder:text-[#3a3a3a]',
      'focus:border-neutral-500 dark:focus:border-[#555]',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'
export { Input }
