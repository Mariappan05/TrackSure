import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const generateBill = async (order, deliveryProof) => {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Calculate costs
  const baseRate = 50; // Base rate per km
  const distanceCost = (order.actual_distance || order.planned_distance) * baseRate;
  const fuelCost = (order.fuel_consumed_liters || 0) * 100; // ₹100 per liter
  const gst = (distanceCost + fuelCost) * 0.18; // 18% GST
  const total = distanceCost + fuelCost + gst;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; border-bottom: 3px solid #1E3A8A; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #1E3A8A; margin: 0; font-size: 32px; }
        .header p { color: #666; margin: 5px 0; }
        .bill-info { background: #f3f4f6; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .bill-info div { margin: 8px 0; }
        .label { font-weight: bold; color: #1E3A8A; }
        .section { margin: 25px 0; }
        .section-title { font-size: 18px; font-weight: bold; color: #1E3A8A; border-bottom: 2px solid #10B981; padding-bottom: 8px; margin-bottom: 15px; }
        .route { background: #fff; border-left: 4px solid #10B981; padding: 12px; margin: 10px 0; }
        .route-item { margin: 8px 0; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #1E3A8A; color: white; padding: 12px; text-align: left; }
        td { padding: 10px; border-bottom: 1px solid #ddd; }
        .total-row { background: #f3f4f6; font-weight: bold; font-size: 18px; }
        .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; color: #666; }
        .status { display: inline-block; padding: 6px 12px; border-radius: 6px; background: #10B981; color: white; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🚚 TrackSure</h1>
        <p>Delivery Management System</p>
        <p>Invoice & Delivery Receipt</p>
      </div>

      <div class="bill-info">
        <div><span class="label">Order ID:</span> ${order.id.substring(0, 8).toUpperCase()}</div>
        <div><span class="label">Invoice Date:</span> ${formatDate(order.completed_at || new Date())}</div>
        <div><span class="label">Status:</span> <span class="status">DELIVERED</span></div>
        <div><span class="label">Driver:</span> ${order.driver?.full_name || 'N/A'}</div>
        <div><span class="label">Vehicle:</span> ${order.vehicle_type?.toUpperCase() || 'N/A'}</div>
      </div>

      <div class="section">
        <div class="section-title">📍 Route Details</div>
        <div class="route">
          <div class="route-item"><strong>Pickup:</strong> ${order.pickup_address}</div>
          <div class="route-item"><strong>Drop:</strong> ${order.drop_address}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">📊 Delivery Metrics</div>
        <table>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
          <tr>
            <td>Planned Distance</td>
            <td>${order.planned_distance} km</td>
          </tr>
          ${order.actual_distance ? `
          <tr>
            <td>Actual Distance</td>
            <td>${order.actual_distance} km</td>
          </tr>` : ''}
          ${order.travel_time_minutes ? `
          <tr>
            <td>Travel Time</td>
            <td>${order.travel_time_minutes} minutes</td>
          </tr>` : ''}
          ${order.fuel_consumed_liters ? `
          <tr>
            <td>Fuel Consumed</td>
            <td>${order.fuel_consumed_liters} liters</td>
          </tr>` : ''}
          <tr>
            <td>Started At</td>
            <td>${order.started_at ? formatDate(order.started_at) + ' ' + formatTime(order.started_at) : 'N/A'}</td>
          </tr>
          <tr>
            <td>Completed At</td>
            <td>${order.completed_at ? formatDate(order.completed_at) + ' ' + formatTime(order.completed_at) : 'N/A'}</td>
          </tr>
        </table>
      </div>

      <div class="section">
        <div class="section-title">💰 Billing Details</div>
        <table>
          <tr>
            <th>Description</th>
            <th>Amount (₹)</th>
          </tr>
          <tr>
            <td>Distance Charges (${order.actual_distance || order.planned_distance} km × ₹${baseRate})</td>
            <td>₹${distanceCost.toFixed(2)}</td>
          </tr>
          ${order.fuel_consumed_liters ? `
          <tr>
            <td>Fuel Charges (${order.fuel_consumed_liters}L × ₹100)</td>
            <td>₹${fuelCost.toFixed(2)}</td>
          </tr>` : ''}
          <tr>
            <td>GST (18%)</td>
            <td>₹${gst.toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td>Total Amount</td>
            <td>₹${total.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${deliveryProof ? `
      <div class="section">
        <div class="section-title">✅ Delivery Confirmation</div>
        <div class="bill-info">
          <div><span class="label">Delivered At:</span> ${formatDate(deliveryProof.delivered_at)} ${formatTime(deliveryProof.delivered_at)}</div>
          <div><span class="label">Location:</span> ${deliveryProof.latitude}, ${deliveryProof.longitude}</div>
          ${deliveryProof.delivery_notes ? `<div><span class="label">Notes:</span> ${deliveryProof.delivery_notes}</div>` : ''}
        </div>
      </div>` : ''}

      <div class="footer">
        <p>Thank you for using TrackSure!</p>
        <p>This is a computer-generated invoice and does not require a signature.</p>
        <p>For queries, contact: support@tracksure.com</p>
      </div>
    </body>
    </html>
  `;

  try {
    const { uri } = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Invoice_${order.id.substring(0, 8)}.pdf`,
      UTI: 'com.adobe.pdf'
    });
  } catch (error) {
    console.error('Bill generation error:', error);
    throw error;
  }
};
