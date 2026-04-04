import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | ClinicPay",
  description: "ClinicPay Terms of Service — governing your use of the ClinicPay payroll platform.",
};

export default function TermsOfServicePage() {
  return (
    <article className="prose prose-slate prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-base prose-h3:mt-6 prose-p:leading-relaxed prose-li:leading-relaxed max-w-none">
      <h1>Terms of Service</h1>
      <p className="text-sm text-slate-500">
        Effective Date: 1 April 2026 &middot; Last Updated: 1 April 2026
      </p>

      <p>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of the ClinicPay
        platform (&quot;Service&quot;), operated by ClinicPay Pte. Ltd. (&quot;ClinicPay&quot;,
        &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), a company incorporated in Singapore. By
        creating an account or using the Service, you (&quot;Customer&quot;, &quot;you&quot;, or
        &quot;your&quot;) agree to be bound by these Terms.
      </p>
      <p>
        If you are entering into these Terms on behalf of a company or other legal entity, you
        represent that you have the authority to bind that entity.
      </p>

      {/* ── 1. Service Description ── */}
      <h2>1. Service Description</h2>
      <p>
        ClinicPay is a cloud-based payroll processing platform designed for Singapore small and
        medium enterprises, with particular focus on clinics and healthcare practices. The Service
        includes:
      </p>
      <ol>
        <li>
          <strong>Payroll processing</strong> — automated pay run workflows including gross-to-net
          calculation, allowances, deductions, and overtime.
        </li>
        <li>
          <strong>CPF calculations</strong> — Central Provident Fund contribution calculations in
          accordance with CPF Board rates, including age-band rates, Ordinary Wages (OW) and
          Additional Wages (AW) classification, and annual ceiling enforcement.
        </li>
        <li>
          <strong>Statutory contributions</strong> — Skills Development Levy (SDL), Foreign Worker
          Levy (FWL), and Self-Help Group (SHG) fund calculations.
        </li>
        <li>
          <strong>Employee management</strong> — employee records, salary history, and onboarding.
        </li>
        <li>
          <strong>Payslip generation</strong> — itemised payslips compliant with the Employment Act.
        </li>
        <li>
          <strong>Bank GIRO file generation</strong> — payment files for DBS, OCBC, UOB, HSBC,
          Standard Chartered, Maybank, and CIMB.
        </li>
        <li>
          <strong>Tax filing support</strong> — IR8A and Auto-Inclusion Scheme (AIS) data
          preparation for IRAS submissions.
        </li>
        <li>
          <strong>Reports</strong> — payroll summaries, CPF reports, headcount reports, and other
          statutory and management reports.
        </li>
      </ol>

      {/* ── 2. Account Terms ── */}
      <h2>2. Account Terms</h2>
      <h3>2.1 Registration</h3>
      <p>
        To use the Service, you must register for an account by providing accurate and complete
        information. You must be at least 18 years of age and legally capable of entering into a
        binding agreement.
      </p>
      <h3>2.2 Account Security</h3>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials.
        ClinicPay supports two-factor authentication (TOTP-based 2FA), and we strongly recommend
        enabling it. You must notify us immediately at{" "}
        <a href="mailto:support@clinicpay.sg">support@clinicpay.sg</a> if you suspect unauthorised
        access to your account.
      </p>
      <h3>2.3 Account Responsibilities</h3>
      <p>
        You are responsible for all activity that occurs under your account, including actions taken
        by users you invite (Admins, Payroll Operators, Report Viewers, and Employees). You must
        ensure that all users comply with these Terms.
      </p>

      {/* ── 3. Subscription & Billing ── */}
      <h2>3. Subscription and Billing</h2>
      <h3>3.1 Plans</h3>
      <p>ClinicPay offers the following plans:</p>
      <ul>
        <li>
          <strong>Free</strong> — up to 5 employees, core payroll features, no charge.
        </li>
        <li>
          <strong>Pro</strong> — S$5 per employee per month, includes unlimited reports, email
          payslips, and employee self-service.
        </li>
        <li>
          <strong>Enterprise</strong> — S$8 per employee per month, includes API access, custom
          integrations, and dual approval workflow.
        </li>
      </ul>
      <h3>3.2 Billing</h3>
      <p>
        Paid plans are billed monthly in arrears based on the number of active employees processed
        during the billing period. Payment is processed via Stripe. All prices are in Singapore
        Dollars (SGD) and exclusive of GST unless otherwise stated.
      </p>
      <h3>3.3 Cancellation</h3>
      <p>
        You may cancel your subscription at any time from the Settings page. Cancellation takes
        effect at the end of the current billing period. You will retain access to the Service until
        then.
      </p>
      <h3>3.4 Refunds</h3>
      <p>
        If you are unsatisfied with the Service, you may request a full refund within 30 days of
        your first payment. Refund requests should be sent to{" "}
        <a href="mailto:support@clinicpay.sg">support@clinicpay.sg</a>. Refunds after the 30-day
        period are granted at our sole discretion.
      </p>

      {/* ── 4. Data Processing ── */}
      <h2>4. Data Processing</h2>
      <p>
        In providing the Service, ClinicPay acts as a <strong>data intermediary</strong> (data
        processor) on your behalf. You, the Customer, remain the <strong>data controller</strong>{" "}
        responsible for the lawfulness of collecting and processing your employees&apos; personal
        data. You warrant that you have obtained all necessary consents from your employees for the
        processing of their personal data through the Service.
      </p>
      <p>
        For details on how we handle personal data, please refer to our{" "}
        <Link href="/privacy" className="text-sky-600 hover:text-sky-700">
          Privacy Policy
        </Link>
        .
      </p>

      {/* ── 5. Acceptable Use ── */}
      <h2>5. Acceptable Use</h2>
      <p>You agree not to:</p>
      <ol>
        <li>
          Use the Service for any unlawful purpose or in violation of any applicable Singapore law,
          including the Employment Act, CPF Act, or Personal Data Protection Act 2012 (PDPA).
        </li>
        <li>
          Attempt to gain unauthorised access to the Service, other users&apos; accounts, or our
          systems and infrastructure.
        </li>
        <li>Reverse engineer, decompile, or disassemble any part of the Service.</li>
        <li>
          Use automated means (bots, scrapers, crawlers) to access or extract data from the Service
          without our prior written consent.
        </li>
        <li>Upload or transmit viruses, malware, or other malicious code.</li>
        <li>Interfere with or disrupt the integrity or performance of the Service.</li>
        <li>Share your account credentials with anyone outside your organisation.</li>
      </ol>

      {/* ── 6. Intellectual Property ── */}
      <h2>6. Intellectual Property</h2>
      <h3>6.1 ClinicPay&apos;s Rights</h3>
      <p>
        The Service, including all software, design, text, graphics, and other content, is the
        property of ClinicPay Pte. Ltd. and is protected by Singapore and international intellectual
        property laws. These Terms do not grant you any right, title, or interest in the Service
        beyond the limited right to use it in accordance with these Terms.
      </p>
      <h3>6.2 Your Data</h3>
      <p>
        You retain all ownership rights to the data you input into the Service, including employee
        records, payroll data, and company information. We do not claim any intellectual property
        rights over your data.
      </p>

      {/* ── 7. CPF Calculation Warranty ── */}
      <h2>7. CPF Calculation Warranty</h2>
      <p>
        ClinicPay warrants that its CPF calculation engine follows the rates, ceilings, and rounding
        rules published by the CPF Board and the Ministry of Manpower (MOM). Specifically:
      </p>
      <ul>
        <li>
          CPF rates are sourced from official CPF Board rate tables and applied based on employee
          age band, citizenship status, and PR graduation year.
        </li>
        <li>
          The Ordinary Wages (OW) ceiling and Additional Wages (AW) ceiling are enforced per CPF
          Board guidelines.
        </li>
        <li>
          Rounding follows CPF Board rules: total CPF rounded to the nearest dollar, employee share
          rounded down, employer share derived as the difference.
        </li>
      </ul>
      <p>
        This warranty is contingent on the accuracy of the data you provide (e.g., employee date of
        birth, citizenship status, salary amounts). ClinicPay is not responsible for calculation
        errors resulting from incorrect input data.
      </p>

      {/* ── 8. Limitation of Liability ── */}
      <h2>8. Limitation of Liability</h2>
      <p>To the maximum extent permitted by Singapore law:</p>
      <ol>
        <li>
          ClinicPay shall not be liable for any indirect, incidental, special, consequential, or
          punitive damages, including but not limited to loss of profits, data, or business
          opportunity, arising out of or in connection with your use of the Service.
        </li>
        <li>
          ClinicPay shall not be liable for payroll errors, incorrect CPF submissions, or late
          payments that result from incorrect data entered by you or your authorised users.
        </li>
        <li>
          ClinicPay&apos;s total aggregate liability for any claims arising from or relating to
          these Terms or the Service shall not exceed the total fees paid by you to ClinicPay in the
          twelve (12) months preceding the claim.
        </li>
        <li>
          The Service is provided &quot;as is&quot; and &quot;as available&quot;. We disclaim all
          warranties, express or implied, including warranties of merchantability, fitness for a
          particular purpose, and non-infringement, except for the CPF Calculation Warranty in
          Section 7.
        </li>
      </ol>

      {/* ── 9. Indemnification ── */}
      <h2>9. Indemnification</h2>
      <p>
        You agree to indemnify, defend, and hold harmless ClinicPay, its officers, directors,
        employees, and agents from and against any claims, liabilities, damages, losses, and
        expenses (including reasonable legal fees) arising out of or in connection with:
      </p>
      <ol>
        <li>Your use of the Service.</li>
        <li>Your violation of these Terms.</li>
        <li>Your violation of any applicable law or regulation.</li>
        <li>Any inaccurate or incomplete data you provide through the Service.</li>
        <li>
          Any claim by a third party (including your employees) arising from payroll processed
          through the Service based on data you provided.
        </li>
      </ol>

      {/* ── 10. Modification of Terms ── */}
      <h2>10. Modification of Terms</h2>
      <p>
        We may modify these Terms from time to time. We will provide at least 30 days&apos; notice
        of material changes by email to the account owner and by posting a notice within the
        Service. Your continued use of the Service after the effective date of the revised Terms
        constitutes acceptance. If you do not agree to the revised Terms, you must stop using the
        Service and cancel your account.
      </p>

      {/* ── 11. Termination ── */}
      <h2>11. Termination</h2>
      <h3>11.1 By You</h3>
      <p>
        You may terminate your account at any time by contacting us at{" "}
        <a href="mailto:support@clinicpay.sg">support@clinicpay.sg</a> or through the Settings page.
      </p>
      <h3>11.2 By ClinicPay</h3>
      <p>
        We may suspend or terminate your account if you violate these Terms, fail to pay applicable
        fees, or if we are required to do so by law. We will provide reasonable notice where
        possible.
      </p>
      <h3>11.3 Effect of Termination</h3>
      <p>
        Upon termination, your right to use the Service ceases immediately. You will have 30 days
        from the date of termination to export your data (employee records, payslips, reports) via
        the Service&apos;s export functionality. After 30 days, we reserve the right to delete your
        data, subject to any statutory retention requirements.
      </p>

      {/* ── 12. Governing Law and Dispute Resolution ── */}
      <h2>12. Governing Law and Dispute Resolution</h2>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the Republic
        of Singapore. Any dispute arising out of or in connection with these Terms shall be subject
        to the exclusive jurisdiction of the courts of Singapore.
      </p>
      <p>
        Before commencing any legal proceedings, both parties agree to attempt to resolve disputes
        through good-faith negotiation for a period of at least 30 days.
      </p>

      {/* ── 13. General Provisions ── */}
      <h2>13. General Provisions</h2>
      <ul>
        <li>
          <strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy,
          constitute the entire agreement between you and ClinicPay regarding the Service.
        </li>
        <li>
          <strong>Severability:</strong> If any provision of these Terms is held to be invalid or
          unenforceable, the remaining provisions shall continue in full force and effect.
        </li>
        <li>
          <strong>Waiver:</strong> Failure by ClinicPay to enforce any right or provision of these
          Terms shall not constitute a waiver of that right or provision.
        </li>
        <li>
          <strong>Assignment:</strong> You may not assign your rights or obligations under these
          Terms without our prior written consent. We may assign our rights and obligations without
          restriction.
        </li>
        <li>
          <strong>Force Majeure:</strong> ClinicPay shall not be liable for any failure or delay in
          performance resulting from causes beyond our reasonable control, including natural
          disasters, government actions, or internet service disruptions.
        </li>
      </ul>

      {/* ── 14. Contact ── */}
      <h2>14. Contact Information</h2>
      <p>If you have any questions about these Terms, please contact us:</p>
      <ul>
        <li>
          <strong>Email:</strong> <a href="mailto:support@clinicpay.sg">support@clinicpay.sg</a>
        </li>
        <li>
          <strong>Company:</strong> ClinicPay Pte. Ltd.
        </li>
        <li>
          <strong>Address:</strong> Singapore
        </li>
      </ul>
    </article>
  );
}
