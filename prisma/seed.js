"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var multiTrackingId, manifestMulti, order;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('Seeding Cubelelo Returns Management Support Data...');
                    // 1. Create required baseline users
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'receiver@cubelelo.com' },
                            update: {},
                            create: {
                                email: 'receiver@cubelelo.com',
                                role: 'RECEIVER',
                                name: 'Receiver User',
                            },
                        })];
                case 1:
                    // 1. Create required baseline users
                    _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'inspector@cubelelo.com' },
                            update: {},
                            create: {
                                email: 'inspector@cubelelo.com',
                                role: 'INSPECTOR',
                                name: 'Inspector User',
                            },
                        })];
                case 2:
                    _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'superaccess@cubelelo.com' },
                            update: {},
                            create: {
                                email: 'superaccess@cubelelo.com',
                                role: 'SUPER_ACCESS',
                                name: 'Super Access User',
                            },
                        })];
                case 3:
                    _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'admin@cubelelo.com' },
                            update: {},
                            create: {
                                email: 'admin@cubelelo.com',
                                role: 'ADMIN',
                                name: 'Admin User',
                            },
                        })];
                case 4:
                    _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'prabhakar16032004@gmail.com' },
                            update: {},
                            create: {
                                email: 'prabhakar16032004@gmail.com',
                                role: 'SUPER_ACCESS',
                                name: 'Prabhakar SuperAdmin',
                            },
                        })];
                case 5:
                    _a.sent();
                    // 2. Clear old data that might conflict
                    return [4 /*yield*/, prisma.evidence.deleteMany()];
                case 6:
                    // 2. Clear old data that might conflict
                    _a.sent();
                    return [4 /*yield*/, prisma.reimbursement.deleteMany()];
                case 7:
                    _a.sent();
                    return [4 /*yield*/, prisma.returnItem.deleteMany()];
                case 8:
                    _a.sent();
                    return [4 /*yield*/, prisma.manifest.deleteMany()];
                case 9:
                    _a.sent();
                    return [4 /*yield*/, prisma.order.deleteMany()];
                case 10:
                    _a.sent();
                    multiTrackingId = 'AWB-MULTI-ITEM-777';
                    return [4 /*yield*/, prisma.manifest.create({
                            data: {
                                trackingId: multiTrackingId,
                                status: 'EXPECTED',
                                marketplace: 'AMAZON',
                                courierName: 'Delhivery',
                                expectedDate: new Date(),
                            }
                        })];
                case 11:
                    manifestMulti = _a.sent();
                    return [4 /*yield*/, prisma.order.create({
                            data: {
                                marketplace: 'AMAZON',
                                platformOrderId: multiTrackingId,
                                requestDate: new Date(),
                                totalAmount: 13894.00, // Sum of 499 + 399 + (4599*2) + (1899*2)
                                fulfillmentChannel: 'FBA',
                                manifestId: manifestMulti.id,
                                trackingNumber: '52103257345',
                            }
                        })];
                case 12:
                    order = _a.sent();
                    // Create 6 ReturnItems (LPNs)
                    return [4 /*yield*/, prisma.returnItem.create({
                            data: {
                                sku: 'CUBE-PRO-LITE',
                                lpn: 'LPN-MULTI-001',
                                reason: 'Quality not as expected',
                                productName: 'Cubelelo Pro Lite 3x3 Speed Cube',
                            }
                        })];
                case 13:
                    // Create 6 ReturnItems (LPNs)
                    _a.sent();
                    return [4 /*yield*/, prisma.returnItem.create({
                            data: {
                                sku: 'CUBE-DRIFT-3X3',
                                lpn: 'LPN-MULTI-002',
                                reason: 'Performance issue',
                                productName: 'Cubelelo Drift 3x3 Magnetic Cube',
                            }
                        })];
                case 14:
                    _a.sent();
                    // GAN-11-PRO (2 units -> 2 distinct LPNs)
                    return [4 /*yield*/, prisma.returnItem.create({
                            data: {
                                sku: 'GAN-11-PRO',
                                lpn: 'LPN-MULTI-003',
                                reason: 'Scratched exterior',
                                productName: 'GAN 11 M Pro UV 3x3',
                            }
                        })];
                case 15:
                    // GAN-11-PRO (2 units -> 2 distinct LPNs)
                    _a.sent();
                    return [4 /*yield*/, prisma.returnItem.create({
                            data: {
                                sku: 'GAN-11-PRO',
                                lpn: 'LPN-MULTI-004',
                                reason: 'Scratched exterior',
                                productName: 'GAN 11 M Pro UV 3x3',
                            }
                        })];
                case 16:
                    _a.sent();
                    // MOYU-SUPER-RS3M (2 units -> 2 distinct LPNs)
                    return [4 /*yield*/, prisma.returnItem.create({
                            data: {
                                sku: 'MOYU-SUPER-RS3M',
                                lpn: 'LPN-MULTI-005',
                                reason: 'Missing accessories',
                                productName: 'MoYu Super RS3M Ball-Core',
                            }
                        })];
                case 17:
                    // MOYU-SUPER-RS3M (2 units -> 2 distinct LPNs)
                    _a.sent();
                    return [4 /*yield*/, prisma.returnItem.create({
                            data: {
                                sku: 'MOYU-SUPER-RS3M',
                                lpn: 'LPN-MULTI-006',
                                reason: 'Defective tensioning system',
                                productName: 'MoYu Super RS3M Ball-Core',
                            }
                        })];
                case 18:
                    _a.sent();
                    console.log('Seeding completed successfully!');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
