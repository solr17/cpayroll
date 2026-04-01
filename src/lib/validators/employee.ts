import { z } from "zod";

export const createEmployeeSchema = z.object({
  nric: z
    .string()
    .regex(/^[STFGM]\d{7}[A-Z]$/i, "Invalid NRIC/FIN format"),
  fullName: z.string().min(1, "Full name is required").max(200),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  gender: z.enum(["M", "F"]).optional(),
  nationality: z.string().optional(),
  citizenshipStatus: z.enum(["SC", "PR1", "PR2", "PR3", "FW"]),
  prEffectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  mobile: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  employeeCode: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  confirmationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  probationEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  employmentType: z.enum(["FT", "PT", "CONTRACT", "LOCUM"]).default("FT"),
  contractEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  bankDetails: z
    .object({
      bankName: z.string(),
      branchCode: z.string(),
      accountNumber: z.string(),
      payNowLinked: z.string().optional(),
    })
    .optional(),
  cpfAccountNumber: z.string().optional(),
  workPassType: z.string().optional(),
  workPassExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  taxRefNumber: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ nric: true });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
