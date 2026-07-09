/**
 * Map Firebase Auth error codes to Vietnamese, user-friendly messages.
 * Pure — no React/Next imports, so it stays testable and reusable.
 */
const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "Địa chỉ email không hợp lệ.",
  "auth/missing-email": "Vui lòng nhập email.",
  "auth/missing-password": "Vui lòng nhập mật khẩu.",
  "auth/email-already-in-use": "Email này đã được đăng ký.",
  "auth/weak-password": "Mật khẩu quá yếu (tối thiểu 6 ký tự).",
  "auth/user-not-found": "Không tìm thấy tài khoản với email này.",
  "auth/wrong-password": "Sai mật khẩu.",
  "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
  "auth/too-many-requests":
    "Bạn thử quá nhiều lần. Vui lòng thử lại sau ít phút.",
  "auth/network-request-failed": "Lỗi mạng. Kiểm tra kết nối rồi thử lại.",
  "auth/popup-closed-by-user": "Bạn đã đóng cửa sổ đăng nhập.",
  "auth/popup-blocked":
    "Trình duyệt đã chặn cửa sổ đăng nhập. Hãy cho phép popup rồi thử lại.",
  "auth/cancelled-popup-request": "Đã hủy yêu cầu đăng nhập trước đó.",
  "auth/account-exists-with-different-credential":
    "Email này đã đăng ký bằng phương thức khác.",
  "auth/unauthorized-domain":
    "Tên miền chưa được cho phép trong Firebase (thêm 'localhost' vào Authorized domains).",
};

/** Extract a `code` string from an unknown thrown value, if present. */
function getCode(err: unknown): string | undefined {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

export function authErrorMessage(err: unknown): string {
  const code = getCode(err);
  if (code && MESSAGES[code]) return MESSAGES[code];
  if (err instanceof Error && err.message) return err.message;
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}
