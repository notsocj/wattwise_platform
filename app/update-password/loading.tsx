import LoadingIndicator from "@/components/ui/LoadingIndicator";

export default function UpdatePasswordLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6 text-white">
      <LoadingIndicator label="Loading" />
    </div>
  );
}
