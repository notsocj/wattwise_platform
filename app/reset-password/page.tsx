import UpdatePasswordForm from '@/components/ui/UpdatePasswordForm';

export default function ResetPasswordPage() {
  return <UpdatePasswordForm mode="reset" backHref="/dashboard" />;
}
