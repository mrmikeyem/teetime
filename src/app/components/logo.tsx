import Image from "next/image";

export function Logo({
  size = 96,
  className,
  priority,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Tee Time Tracker"
      width={size}
      height={size}
      priority={priority}
      className={className}
    />
  );
}
