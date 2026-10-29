import Swal, { type SweetAlertIcon, type SweetAlertResult } from 'sweetalert2'

export function showSweetAlert(
  icon: SweetAlertIcon,
  title: string,
  text: string,
): Promise<SweetAlertResult> {
  return Swal.fire({
    icon,
    title,
    text,
    confirmButtonText: 'OK',
    confirmButtonColor: '#4f46e5',
  })
}

export function showSweetToast(
  icon: SweetAlertIcon,
  title: string,
): Promise<SweetAlertResult> {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    showConfirmButton: false,
    timer: 3200,
    timerProgressBar: true,
  })
}

export { Swal }
