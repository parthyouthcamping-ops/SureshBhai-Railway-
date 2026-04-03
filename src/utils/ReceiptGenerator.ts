import { jsPDF } from 'jspdf';
import type { Booking } from '../types';
import { format } from 'date-fns';

/**
 * Generates a Premium YouthCamping Receipt PDF.
 * @param booking - The booking data
 * @param collectorName - Who collected the cash
 * @param mode - 'download' to trigger save, 'base64' to return data string for email
 */
export const generateReceipt = (booking: Booking, collectorName: string, mode: 'download' | 'base64' = 'download') => {
  const doc = new jsPDF();
  const dateStr = format(new Date(), 'dd MMM yyyy, HH:mm');

  // Background
  doc.setFillColor(245, 247, 250);
  doc.rect(0, 0, 210, 297, 'F');

  // Header Box
  doc.setFillColor(11, 60, 93);
  doc.rect(0, 0, 210, 50, 'F');

  // Brand Identity
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text('YOUTHCAMPING', 105, 22, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL PAYMENT RECEIPT', 105, 32, { align: 'center' });
  
  doc.setDrawColor(255, 115, 22); 
  doc.setLineWidth(1.5);
  doc.line(80, 38, 130, 38);

  // Main Card
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(15, 60, 180, 150, 5, 5, 'F');
  
  doc.setTextColor(11, 60, 93);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TREVELER DETAILS', 25, 75);
  
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.5);
  doc.line(25, 80, 185, 80);

  const startY = 93;
  const lineSpacing = 12;

  const renderRow = (label: string, value: string, y: number, isTotal = false) => {
    doc.setFontSize(11);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text(label, 25, y);
    
    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', isTotal ? 'bold' : 'normal');
    const displayVal = value || 'N/A';
    doc.text(displayVal, 100, y);
  };

  renderRow('Name:', booking.name, startY);
  renderRow('Mobile No:', booking.phone, startY + lineSpacing);
  renderRow('Tour Name:', booking.trip_name || 'YouthCamping Trip', startY + (lineSpacing * 2));
  renderRow('Room No:', booking.room || 'NA', startY + (lineSpacing * 3));
  renderRow('Date:', dateStr, startY + (lineSpacing * 4));

  // Payment Breakdown Box
  doc.setFillColor(249, 115, 22, 0.05); 
  doc.roundedRect(25, 158, 160, 35, 3, 3, 'F');
  
  doc.setTextColor(249, 115, 22);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT PAID:', 35, 172);
  doc.setFontSize(16);
  doc.text(`INR ${(booking.paid_amount || 0).toLocaleString()}`, 35, 184);

  doc.setTextColor(100, 100, 100);
  doc.setFontSize(10);
  doc.text('REMAINING BALANCE:', 115, 172);
  doc.setTextColor(239, 68, 68); 
  doc.setFontSize(12);
  doc.text(`INR ${(booking.remaining_amount || 0).toLocaleString()}`, 115, 184);

  // Status & Collector
  doc.setTextColor(50, 50, 50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Collected By: ${collectorName}`, 25, 225);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text('This is a computer-generated confirmation.', 105, 240, { align: 'center' });
  
  doc.setTextColor(11, 60, 93);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank you for Travel with YouthCamping!', 105, 260, { align: 'center' });

  if (mode === 'download') {
    doc.save(`Receipt_${booking.sr_no}_${booking.name.replace(/\s/g, '_')}.pdf`);
    return null;
  } else {
    // Return base64 without the 'data:application/pdf;base64,' prefix for Resend
    return doc.output('datauristring').split(',')[1];
  }
};
