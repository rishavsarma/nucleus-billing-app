"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  BellIcon,
  CalendarIcon,
  ChevronRightIcon,
  CreditCardIcon,
  HomeIcon,
  MailIcon,
  PlusIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Checkbox } from "@/components/ui/checkbox"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field"
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
} from "@/components/ui/menubar"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Calendar } from "@/components/ui/calendar"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Separator } from "@/components/ui/separator"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

/**
 * Kitchen-sink render of every shadcn/ui primitive, grouped by category, so
 * switching the theme preset (ThemePresetSelector) shows its effect across
 * the whole component set at once instead of hunting through real pages.
 * Diagnostic scaffold, not shipped product surface — same treatment as the
 * dashboard-01 demo block noted in CLAUDE.md, so strings here are plain
 * English rather than routed through next-intl.
 */

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-wrap items-start gap-4">{children}</CardContent>
    </Card>
  )
}

export function ThemeShowcase() {
  const [sliderValue, setSliderValue] = React.useState([40])
  const [progress, setProgress] = React.useState(35)

  React.useEffect(() => {
    const id = setInterval(() => {
      setProgress((p) => (p >= 100 ? 20 : p + 15))
    }, 2500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col gap-6 px-4 pb-10 lg:px-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Component showcase</h2>
        <p className="text-muted-foreground text-sm">
          Every shadcn primitive in one place — switch the theme preset above to see radius,
          color, shadow, and font apply live across all of them.
        </p>
      </div>

      <Section title="Buttons" description="Variants, sizes, and grouped buttons">
        <Button>Default</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
        <Button variant="link">Link</Button>
        <Separator orientation="vertical" className="h-8" />
        <Button size="xs">XS</Button>
        <Button size="sm">Small</Button>
        <Button size="lg">Large</Button>
        <Button size="icon" aria-label="Star">
          <StarIcon />
        </Button>
        <ButtonGroup>
          <Button variant="outline">
            <MailIcon /> Email
          </Button>
          <ButtonGroupSeparator />
          <Button variant="outline">
            <BellIcon /> Notify
          </Button>
        </ButtonGroup>
      </Section>

      <Section title="Badges">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
      </Section>

      <Section title="Form inputs" description="Input, select, and choice controls">
        <div className="flex w-full flex-wrap gap-4">
          <FieldSet className="w-full max-w-sm">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="showcase-name">Name</FieldLabel>
                <Input id="showcase-name" placeholder="Ada Lovelace" />
              </Field>
              <Field>
                <FieldLabel htmlFor="showcase-notes">Notes</FieldLabel>
                <Textarea id="showcase-notes" placeholder="Anything else…" />
                <FieldDescription>Shown to the accounts team only.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="showcase-search">Search</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="showcase-search" placeholder="Search invoices…" />
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs" variant="ghost">
                      <PlusIcon />
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              <FieldSeparator />
              <Field>
                <FieldLabel htmlFor="showcase-otp">One-time code</FieldLabel>
                <InputOTP id="showcase-otp" maxLength={6}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                  </InputOTPGroup>
                  <InputOTPSeparator />
                  <InputOTPGroup>
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </Field>
            </FieldGroup>
          </FieldSet>

          <div className="flex flex-col gap-4">
            <Field>
              <FieldLabel>Preset select</FieldLabel>
              <Select defaultValue="monthly">
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Native select</FieldLabel>
              <NativeSelect defaultValue="draft" className="w-48">
                <NativeSelectOption value="draft">Draft</NativeSelectOption>
                <NativeSelectOption value="sent">Sent</NativeSelectOption>
                <NativeSelectOption value="paid">Paid</NativeSelectOption>
              </NativeSelect>
            </Field>
            <div className="flex items-center gap-2">
              <Checkbox id="showcase-checkbox" defaultChecked />
              <Label htmlFor="showcase-checkbox">Auto-send receipts</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="showcase-switch" defaultChecked />
              <Label htmlFor="showcase-switch">Enable notifications</Label>
            </div>
            <RadioGroup defaultValue="card" className="gap-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="card" id="showcase-r1" />
                <Label htmlFor="showcase-r1">Card</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="bank" id="showcase-r2" />
                <Label htmlFor="showcase-r2">Bank transfer</Label>
              </div>
            </RadioGroup>
            <div className="w-48">
              <Label className="mb-2">Discount ({sliderValue[0]}%)</Label>
              <Slider value={sliderValue} onValueChange={setSliderValue} max={100} step={1} />
            </div>
            <div className="flex gap-2">
              <Toggle aria-label="Toggle bold">B</Toggle>
              <ToggleGroup type="single" defaultValue="left">
                <ToggleGroupItem value="left">Left</ToggleGroupItem>
                <ToggleGroupItem value="center">Center</ToggleGroupItem>
                <ToggleGroupItem value="right">Right</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Avatars, alerts, empty & item states">
        <div className="flex w-full flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar>
              <AvatarImage src="/placeholder.svg" alt="" />
              <AvatarFallback>AL</AvatarFallback>
            </Avatar>
            <AvatarGroup>
              <Avatar>
                <AvatarFallback>A</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>B</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarFallback>C</AvatarFallback>
              </Avatar>
            </AvatarGroup>
            <KbdGroup>
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </div>

          <Alert>
            <AlertTitle>Heads up</AlertTitle>
            <AlertDescription>This is a default alert used for informational copy.</AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>The card on file was declined.</AlertDescription>
          </Alert>

          <ItemGroup>
            <Item variant="outline">
              <ItemMedia>
                <CreditCardIcon className="size-4" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>Invoice #1042</ItemTitle>
                <ItemDescription>Due in 3 days</ItemDescription>
              </ItemContent>
              <ItemActions>
                <Badge variant="outline">Pending</Badge>
              </ItemActions>
            </Item>
          </ItemGroup>

          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <SearchIcon />
              </EmptyMedia>
              <EmptyTitle>No results</EmptyTitle>
              <EmptyDescription>Try a different search term.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm">
                Clear search
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </Section>

      <Section title="Overlays" description="Dialog, alert dialog, sheet, drawer, popover, hover card, tooltip">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit customer</DialogTitle>
              <DialogDescription>Update the customer&apos;s billing details.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Company name" />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">Delete invoice</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>This action can&apos;t be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Open sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
              <SheetDescription>Narrow down the invoice list.</SheetDescription>
            </SheetHeader>
            <SheetFooter>
              <Button>Apply</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="outline">Open drawer</Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Quick actions</DrawerTitle>
              <DrawerDescription>Pick something to do next.</DrawerDescription>
            </DrawerHeader>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Close</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Open popover</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-sm">Popover content sits on the popover surface color.</p>
          </PopoverContent>
        </Popover>

        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="outline">Hover card</Button>
          </HoverCardTrigger>
          <HoverCardContent>
            <p className="text-sm">Appears on hover, same surface treatment as popover.</p>
          </HoverCardContent>
        </HoverCard>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover for tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>

        <Button variant="outline" onClick={() => toast("Invoice sent", { description: "Reminder emailed to the customer." })}>
          Trigger toast
        </Button>
      </Section>

      <Section title="Menus" description="Dropdown, context, and menubar">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Dropdown menu</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <UserIcon /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <SettingsIcon /> Settings
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">
              <TrashIcon /> Delete account
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div className="flex h-9 items-center rounded-md border border-dashed px-4 text-sm text-muted-foreground">
              Right-click here
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem>
              <CalendarIcon /> Reschedule
            </ContextMenuItem>
            <ContextMenuItem>
              <TrashIcon /> Remove
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>File</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>New invoice</MenubarItem>
              <MenubarItem>Export</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>View</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Zoom in</MenubarItem>
              <MenubarItem>Zoom out</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      </Section>

      <Section title="Navigation" description="Tabs, accordion, collapsible, breadcrumb, pagination">
        <div className="flex w-full flex-col gap-6">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="#">
                  <HomeIcon className="size-3.5" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href="#">Sales</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Invoices</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="text-muted-foreground text-sm">
              Overview tab content.
            </TabsContent>
            <TabsContent value="activity" className="text-muted-foreground text-sm">
              Activity tab content.
            </TabsContent>
            <TabsContent value="settings" className="text-muted-foreground text-sm">
              Settings tab content.
            </TabsContent>
          </Tabs>

          <Accordion type="single" collapsible className="w-full max-w-md">
            <AccordionItem value="item-1">
              <AccordionTrigger>What payment methods are supported?</AccordionTrigger>
              <AccordionContent>Cards, bank transfers, and UPI.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>Can I export invoices?</AccordionTrigger>
              <AccordionContent>Yes, as PDF or CSV from the invoice list.</AccordionContent>
            </AccordionItem>
          </Accordion>

          <Collapsible className="w-full max-w-md">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                Advanced options <ChevronRightIcon className="size-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="text-muted-foreground pt-2 text-sm">
              Hidden content revealed on expand.
            </CollapsibleContent>
          </Collapsible>

          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" />
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#" isActive>
                  1
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationLink href="#">2</PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext href="#" />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </Section>

      <Section title="Command & calendar">
        <Command className="w-full max-w-sm rounded-lg border">
          <CommandInput placeholder="Search commands…" />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Actions">
              <CommandItem>New invoice</CommandItem>
              <CommandItem>New customer</CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Settings">
              <CommandItem>Preferences</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>

        <Calendar mode="single" className="rounded-lg border p-2" />
      </Section>

      <Section title="Data display" description="Table, progress, skeleton, spinner">
        <div className="flex w-full flex-col gap-6">
          <Table>
            <TableCaption>Recent invoices.</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-end">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>#1042</TableCell>
                <TableCell>
                  <Badge variant="outline">Paid</Badge>
                </TableCell>
                <TableCell className="text-end">$250.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>#1043</TableCell>
                <TableCell>
                  <Badge variant="secondary">Pending</Badge>
                </TableCell>
                <TableCell className="text-end">$99.00</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="flex max-w-sm flex-col gap-4">
            <Progress value={progress} />
            <div className="flex items-center gap-3">
              <Spinner className="size-4" />
              <span className="text-muted-foreground text-sm">Loading…</span>
            </div>
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Layout primitives" description="Aspect ratio, carousel, resizable panels">
        <div className="flex w-full flex-col gap-6">
          <AspectRatio ratio={16 / 9} className="bg-muted w-full max-w-sm overflow-hidden rounded-lg">
            <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
              16:9 frame
            </div>
          </AspectRatio>

          <Carousel className="w-full max-w-sm">
            <CarouselContent>
              {[1, 2, 3].map((n) => (
                <CarouselItem key={n}>
                  <div className="bg-muted flex h-32 items-center justify-center rounded-lg text-2xl font-semibold">
                    {n}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>

          <ResizablePanelGroup orientation="horizontal" className="h-32 max-w-sm rounded-lg border">
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center text-sm">Left</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50}>
              <div className="flex h-full items-center justify-center text-sm">Right</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </Section>
    </div>
  )
}
