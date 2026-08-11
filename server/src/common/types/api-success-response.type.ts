export type ApiSuccessResponse<T> = {
  message: string;
  success: true;
  data: T;
};
