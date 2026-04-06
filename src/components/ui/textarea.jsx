import * as React from 'react'
import { cn } from '../../lib/utils'

const Textarea = React.forwardRef(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'flex w-full rounded-md bg-transparent text-[13px] outline-none leading-relaxed resize-none',
      'text-neutral-900 dark:text-[#ddd] placeholder:text-neutral-400 dark:placeholder:text-[#3a3a3a]',
      className,
    )}
    {...props}
  />
))
Textarea.displayName = 'Textarea'
export { Textarea }
